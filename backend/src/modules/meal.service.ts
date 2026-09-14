import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MealSession } from '../entities/meal-session.entity';
import { MealOrder } from '../entities/meal-order.entity';
import { MealPreparation } from '../entities/meal-preparation.entity';
import { FoodSample } from '../entities/food-sample.entity';
import { MealDelivery } from '../entities/meal-delivery.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { Worker } from '../entities/worker.entity';
import { Canteen } from '../entities/canteen.entity';
import { OrgService } from './org.service';
import { allocate, synthesizeOne } from './allocation';

const SHIFT_NAMES: Record<string, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', midnight: '夜宵',
};

@Injectable()
export class MealService {
  constructor(
    @InjectRepository(MealSession) private sessions: Repository<MealSession>,
    @InjectRepository(MealOrder) private orders: Repository<MealOrder>,
    @InjectRepository(MealPreparation) private preps: Repository<MealPreparation>,
    @InjectRepository(FoodSample) private samples: Repository<FoodSample>,
    @InjectRepository(MealDelivery) private deliveries: Repository<MealDelivery>,
    @InjectRepository(MealPickup) private pickups: Repository<MealPickup>,
    @InjectRepository(Worker) private workers: Repository<Worker>,
    @InjectRepository(Canteen) private canteens: Repository<Canteen>,
    private org: OrgService,
    private ds: DataSource,
  ) {}

  shiftName(s: string) { return SHIFT_NAMES[s] || s; }

  // ---------------- 餐次 ----------------
  async listSessions(date?: string) {
    const where = date ? { date } : {};
    const list = await this.sessions.find({
      where, relations: ['canteen'], order: { date: 'DESC', id: 'DESC' },
    });
    for (const s of list) {
      const agg = await this.sessionAgg(s.id);
      Object.assign(s, agg);
    }
    return list;
  }

  async sessionAgg(sessionId: number) {
    const o = await this.orders.find({ where: { sessionId } });
    const p = await this.preps.find({ where: { sessionId } });
    const pk = await this.pickups.find({ where: { sessionId } });
    const ordered = o.reduce((a, x) => a + x.headcount, 0);
    const generated = o.reduce((a, x) => a + (x.generatedCount || 0), 0);
    const prepared = p.reduce((a, x) => a + (x.preparedCount || 0), 0);
    const picked = pk.length;
    const lost = p.reduce((a, x) => a + (x.lossCount || 0), 0);
    const wasted = Math.max(prepared - picked, 0) + lost;
    return {
      orderTeams: o.length, orderedCount: ordered, generatedCount: generated,
      preparedCount: prepared, pickedCount: picked, lostCount: lost, wastedCount: wasted,
      pickupRate: generated ? +(picked / generated * 100).toFixed(1) : 0,
      wasteRate: prepared ? +(wasted / prepared * 100).toFixed(1) : 0,
    };
  }

  async sessionDetail(id: number) {
    const s = await this.sessions.findOne({
      where: { id },
      relations: ['canteen', 'orders', 'orders.team', 'preparations', 'preparations.supplier',
        'preparations.samples', 'deliveries'],
    });
    if (!s) throw new NotFoundException('餐次不存在');
    const agg = await this.sessionAgg(id);
    const pickups = await this.pickups.find({
      where: { sessionId: id }, relations: ['worker', 'team'], order: { id: 'DESC' }, take: 100,
    });
    const money = pickups.reduce(
      (a, p) => ({
        worker: a.worker + Number(p.workerSubsidy),
        company: a.company + Number(p.companySubsidy),
        self: a.self + Number(p.selfPay),
      }),
      { worker: 0, company: 0, self: 0 },
    );
    return { ...s, ...agg, recentPickups: pickups, money };
  }

  async createSession(dto: Partial<MealSession>) {
    if (!dto.date || !dto.shift || !dto.canteenId) throw new BadRequestException('日期/班次/食堂必填');
    const exist = await this.sessions.findOne({ where: { date: dto.date, shift: dto.shift } });
    if (exist) throw new BadRequestException('该日期班次餐次已存在');
    const s = this.sessions.create({
      date: dto.date, shift: dto.shift, canteenId: dto.canteenId, status: 'open',
      price: dto.price ?? 15, workerSubsidy: dto.workerSubsidy ?? 8, companySubsidy: dto.companySubsidy ?? 5,
      weather: dto.weather ?? '', note: dto.note,
    });
    return this.sessions.save(s);
  }

  async setSessionStatus(id: number, status: string) {
    const s = await this.sessions.findOne({ where: { id } });
    if (!s) throw new NotFoundException('餐次不存在');
    s.status = status;
    return this.sessions.save(s);
  }

  // ---------------- 班组长订餐 ----------------
  listOrders(sessionId: number) {
    return this.orders.find({ where: { sessionId }, relations: ['team', 'foreman'] });
  }

  async submitOrder(dto: any, foremanId: number) {
    const session = await this.sessions.findOne({ where: { id: dto.sessionId } });
    if (!session) throw new NotFoundException('餐次不存在');
    if (['closed', 'stopped'].includes(session.status)) throw new BadRequestException('餐次已结束/取消，不能申报');
    let order = await this.orders.findOne({ where: { sessionId: dto.sessionId, teamId: dto.teamId } });
    if (!order) order = this.orders.create({ sessionId: dto.sessionId, teamId: dto.teamId, foremanId });
    Object.assign(order, {
      headcount: +dto.headcount || 0,
      trades: dto.trades || '',
      nightSnackCount: +dto.nightSnackCount || 0,
      ethnicCount: +dto.ethnicCount || 0,
      overtimeCount: +dto.overtimeCount || 0,
      deliveryZone: dto.deliveryZone || '',
      remark: dto.remark || '',
      status: 'draft',
    });
    return this.orders.save(order);
  }

  /**
   * 生成订餐：需求量由【实名考勤、宿舍人数、施工计划、班组申报】共同合成（可追溯），
   * 叠加临时加班/夜宵，清真餐保底；再受【食堂产能】硬约束，
   * 用最大余数法分配，保证各班组分配总和绝不超过产能，压缩时清真餐优先。
   */
  async generateOrders(sessionId: number) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('餐次不存在');
    const canteen = await this.canteens.findOne({ where: { id: session.canteenId } });
    const orders = await this.orders.find({ where: { sessionId }, relations: ['team'] });
    if (!orders.length) throw new BadRequestException('尚无班组申报订餐');

    // 夜宵餐次对应夜班考勤/施工计划，其余对应白班
    const isMidnight = session.shift === 'midnight';
    const attendShift = isMidnight ? 'night' : 'day';
    const presentMap = await this.org.presentCounts(session.date, attendShift);
    const planMap = await this.org.planCounts(session.date, attendShift);

    // 逐班组合成可追溯需求
    const demandRows = orders.map((o) => synthesizeOne({
      teamId: o.teamId,
      present: presentMap[o.teamId] ?? 0,
      dorm: o.team?.dormHeadcount ?? 0,
      plan: planMap[o.teamId]?.plannedWorkers ?? 0,
      declared: o.headcount || 0,
      overtime: o.overtimeCount || 0,
      nightSnack: o.nightSnackCount || 0,
      ethnic: o.ethnicCount || 0,
      isMidnight,
    }));

    const capacity = canteen?.capacity || 9999;
    const result = allocate(demandRows, capacity);

    // 落库：分配量 + 需求分解（可追溯）
    for (let idx = 0; idx < orders.length; idx++) {
      const o = orders[idx];
      const r = result.rows[idx];
      o.generatedCount = r.allocated;
      o.status = result.capacityAdjusted ? 'adjusted' : 'generated';
      o.demandDetail = JSON.stringify({
        present: r.present, dorm: r.dorm, plan: r.plan, declared: r.declared,
        overtime: r.overtime, nightSnack: r.nightSnack, ethnic: r.ethnic,
        baseWorkers: r.baseWorkers, cappedDorm: r.cappedDorm,
        rawDemand: r.rawDemand, want: r.want,
        allocated: r.allocated, ethnicAllocated: r.ethnicAllocated, regularAllocated: r.regularAllocated,
      });
      await this.orders.save(o);
    }

    const ethnicTotal = result.rows.reduce((a, r) => a + Math.min(r.ethnic, r.want), 0);
    const ethnicAllocated = result.rows.reduce((a, r) => a + r.ethnicAllocated, 0);
    session.status = 'confirmed';
    await this.sessions.save(session);

    return {
      totalWant: result.totalWant,
      capacity: result.capacity,
      generated: result.allocated,
      capacityAdjusted: result.capacityAdjusted,
      ethnicTotal,
      ethnicAllocated,
      // 可追溯的逐班组分解
      breakdown: result.rows.map((r) => ({
        teamId: r.teamId,
        teamName: orders.find((o) => o.teamId === r.teamId)?.team?.name || `班组${r.teamId}`,
        present: r.present, dorm: r.dorm, plan: r.plan, declared: r.declared,
        overtime: r.overtime, nightSnack: r.nightSnack, ethnic: r.ethnic,
        baseWorkers: r.baseWorkers, cappedDorm: r.cappedDorm,
        want: r.want, allocated: r.allocated,
        ethnicAllocated: r.ethnicAllocated, regularAllocated: r.regularAllocated,
      })),
      orders: await this.orders.find({ where: { sessionId }, relations: ['team'] }),
    };
  }

  // ---------------- 食堂备餐 / 留样 / 配送 ----------------
  async createPreparation(dto: any) {
    const p = this.preps.create({
      sessionId: dto.sessionId, menu: dto.menu, ingredientBatch: dto.ingredientBatch,
      supplierId: dto.supplierId || null, chef: dto.chef,
      coreTemp: dto.coreTemp ?? null, ambientTemp: dto.ambientTemp ?? null,
      cookTime: dto.cookTime, serveTime: dto.serveTime,
      preparedCount: +dto.preparedCount || 0, shortageCount: +dto.shortageCount || 0,
      lossCount: +dto.lossCount || 0, note: dto.note,
    });
    return this.preps.save(p);
  }

  listPreparations(sessionId: number) {
    return this.preps.find({ where: { sessionId }, relations: ['supplier', 'samples'] });
  }

  async createSample(dto: any) {
    const prep = await this.preps.findOne({ where: { id: dto.preparationId } });
    if (!prep) throw new NotFoundException('备餐记录不存在');
    const now = new Date();
    const s = this.samples.create({
      preparationId: prep.id, dishName: dto.dishName,
      weightGram: dto.weightGram ?? 125, boxNo: dto.boxNo, fridgeTemp: dto.fridgeTemp ?? 4,
      sampledBy: dto.sampledBy || prep.chef, sampleAt: now,
      expireAt: new Date(now.getTime() + 48 * 3600 * 1000),
      status: 'retained',
    });
    return this.samples.save(s);
  }

  async listSamples(status?: string) {
    return this.samples.find({
      where: status ? { status } : {},
      relations: ['preparation', 'preparation.session'],
      order: { id: 'DESC' }, take: 200,
    });
  }

  async setSampleResult(id: number, dto: { status: string; labResult?: string }) {
    const s = await this.samples.findOne({ where: { id } });
    if (!s) throw new NotFoundException('留样不存在');
    s.status = dto.status; // passed / failed / disposed
    s.labResult = dto.labResult || s.labResult;
    return this.samples.save(s);
  }

  async createDelivery(dto: any) {
    const d = this.deliveries.create({
      sessionId: dto.sessionId, zone: dto.zone, route: dto.route, count: +dto.count || 0,
      keepWarmTemp: dto.keepWarmTemp ?? null, carrier: dto.carrier, safetyCheck: dto.safetyCheck,
      departAt: dto.departAt ? new Date(dto.departAt) : null,
      arriveAt: dto.arriveAt ? new Date(dto.arriveAt) : null,
      status: dto.status || 'planned',
    });
    return this.deliveries.save(d);
  }

  listDeliveries(sessionId: number) {
    return this.deliveries.find({ where: { sessionId }, order: { id: 'ASC' } });
  }

  async updateDelivery(id: number, dto: Partial<{ status: string; keepWarmTemp: number; departAt: string; arriveAt: string }>) {
    const d = await this.deliveries.findOne({ where: { id } });
    if (!d) throw new NotFoundException('配送记录不存在');
    if (dto.status) d.status = dto.status;
    if (dto.keepWarmTemp !== undefined && dto.keepWarmTemp !== null) d.keepWarmTemp = dto.keepWarmTemp;
    if (dto.departAt) d.departAt = new Date(dto.departAt);
    if (dto.arriveAt) d.arriveAt = new Date(dto.arriveAt);
    if (dto.status === 'in_transit' && !d.departAt) d.departAt = new Date();
    if (dto.status === 'delivered' && !d.arriveAt) d.arriveAt = new Date();
    return this.deliveries.save(d);
  }

  // ---------------- 取餐（刷脸/扫码）与费用核算 ----------------
  async pickup(dto: { sessionId: number; workerId?: number; code?: string; method?: string; teamId?: number; operator?: string }) {
    const session = await this.sessions.findOne({ where: { id: dto.sessionId } });
    if (!session) throw new NotFoundException('餐次不存在');
    if (!['confirmed', 'preparing', 'serving'].includes(session.status)) {
      throw new BadRequestException(`当前餐次状态(${session.status})不可取餐`);
    }
    let worker: Worker | null = null;
    if (dto.workerId) worker = await this.workers.findOne({ where: { id: dto.workerId }, relations: ['team'] });
    else if (dto.code) worker = await this.workers.findOne({ where: { pickupCode: dto.code }, relations: ['team'] });
    if (!worker) throw new NotFoundException('未识别到工人（新工人请先实名登记）');

    const dup = await this.pickups.findOne({ where: { sessionId: dto.sessionId, workerId: worker.id } });
    if (dup) throw new BadRequestException('该工人本餐次已取餐，请勿重复领取');

    const serveTeamId = dto.teamId || worker.teamId;
    const crossTeam = serveTeamId !== worker.teamId;
    const unverified = !worker.verified;

    // 费用核算：已实名在岗 → 个人餐补 + 企业补贴，自费=餐标-补贴；未实名 → 暂不享补贴，全额自费（后续实名可争议补发）
    const price = Number(session.price);
    let workerSub = unverified ? 0 : Number(session.workerSubsidy);
    let companySub = unverified ? 0 : Number(session.companySubsidy);
    if (workerSub + companySub > price) companySub = Math.max(price - workerSub, 0);
    const selfPay = +(price - workerSub - companySub).toFixed(2);

    const rec = this.pickups.create({
      sessionId: dto.sessionId, workerId: worker.id, teamId: serveTeamId,
      method: dto.method || 'face', crossTeam, unverified,
      price, workerSubsidy: workerSub, companySubsidy: companySub, selfPay,
      operator: dto.operator || '',
    });
    const saved = await this.pickups.save(rec);

    // 回填班组订餐取餐数
    const order = await this.orders.findOne({ where: { sessionId: dto.sessionId, teamId: serveTeamId } });
    if (order) { order.pickedCount = (order.pickedCount || 0) + 1; await this.orders.save(order); }
    if (session.status !== 'serving') { session.status = 'serving'; await this.sessions.save(session); }

    return this.pickups.findOne({ where: { id: saved.id }, relations: ['worker', 'team'] });
  }

  async listPickups(sessionId?: number, workerId?: number) {
    const where: any = {};
    if (sessionId) where.sessionId = sessionId;
    if (workerId) where.workerId = workerId;
    return this.pickups.find({ where, relations: ['worker', 'team', 'session'], order: { id: 'DESC' }, take: 300 });
  }
}
