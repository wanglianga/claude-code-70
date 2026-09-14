import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtraMeal } from '../entities/extra-meal.entity';
import { ExtraMealPoint } from '../entities/extra-meal-point.entity';
import { ExtraMealPickup } from '../entities/extra-meal-pickup.entity';
import { Canteen } from '../entities/canteen.entity';
import { MealSession } from '../entities/meal-session.entity';
import { Worker } from '../entities/worker.entity';
import { MealPickup } from '../entities/meal-pickup.entity';

/** 高风险作业区关键词：命中则必须由安全员确认送餐路线与停留时间 */
const HIGH_RISK_KEYWORDS = ['塔吊', '高空', '封闭', '深基坑', '吊装', '屋面', '临边', '洞口', '电梯井', '外架'];

export interface PointInput {
  pointName: string;
  teamId?: number;
  route?: string;
  stayMinutes?: number;
  sentCount?: number;
}

@Injectable()
export class ExtraMealService {
  constructor(
    @InjectRepository(ExtraMeal) private extras: Repository<ExtraMeal>,
    @InjectRepository(ExtraMealPoint) private points: Repository<ExtraMealPoint>,
    @InjectRepository(ExtraMealPickup) private extraPickups: Repository<ExtraMealPickup>,
    @InjectRepository(Canteen) private canteens: Repository<Canteen>,
    @InjectRepository(MealSession) private sessions: Repository<MealSession>,
    @InjectRepository(Worker) private workers: Repository<Worker>,
    @InjectRepository(MealPickup) private pickups: Repository<MealPickup>,
  ) {}

  private isHighRisk(text: string) {
    return HIGH_RISK_KEYWORDS.some((k) => (text || '').includes(k));
  }

  /**
   * 发起前四项检查：食堂值班 / 食材余量 / 配送点 / 餐补规则
   * 返回逐项检查结果（不写库），供前端在发起时展示与阻断。
   */
  async precheck(dto: { sessionId: number; requestedCount: number; pointNames?: string[] }) {
    const session = await this.sessions.findOne({ where: { id: dto.sessionId } });
    if (!session) throw new NotFoundException('餐次不存在');
    if (session.shift !== 'midnight') throw new BadRequestException('临时加餐仅支持夜宵餐次');
    const canteen = await this.canteens.findOne({ where: { id: session.canteenId } });

    const points = (dto.pointNames || []).map((n) => (n || '').trim()).filter(Boolean);
    const highRisk = points.some((p) => this.isHighRisk(p));
    const count = Math.max(0, Math.floor(Number(dto.requestedCount) || 0));

    // 夜间加班加餐规则：企业全额承担，个人 0 自付（餐标取夜宵餐次价格）
    const price = Number(session.price) || 12;
    const rule = { price, workerSubsidy: 0, companySubsidy: price, selfPay: 0, desc: '夜间加班加餐·企业全额承担（个人 0 元）' };

    const checks = [
      {
        key: 'duty', label: '食堂夜宵值班', pass: !!canteen?.nightDuty,
        msg: canteen?.nightDuty ? `已安排值班：${canteen.nightDutyChef || '值班厨师'} ${canteen.nightDutyPhone || ''}` : '食堂今晚未安排夜宵值班，无法加餐',
      },
      {
        key: 'stock', label: '食材余量', pass: (canteen?.ingredientStock || 0) >= count && count > 0,
        msg: count > 0
          ? `申请 ${count} 份 / 余量 ${canteen?.ingredientStock || 0} 份${(canteen?.ingredientStock || 0) >= count ? '，充足' : '，不足'}`
          : '申请份数必须大于 0',
      },
      {
        key: 'points', label: '配送点', pass: points.length > 0,
        msg: points.length ? `${points.length} 个施工点：${points.join('、')}` : '未填写配送施工点',
      },
      {
        key: 'rule', label: '餐补规则', pass: true,
        msg: rule.desc,
      },
    ];
    const highRiskPoints = points.filter((p) => this.isHighRisk(p));
    return {
      pass: checks.every((c) => c.pass),
      checks, highRisk, highRiskPoints, rule,
      canteen: canteen ? { id: canteen.id, name: canteen.name, ingredientStock: canteen.ingredientStock } : null,
      confirmedCount: Math.min(count, canteen?.ingredientStock || 0),
    };
  }

  async list(date?: string) {
    let list: ExtraMeal[];
    if (date) {
      list = await this.extras.find({
        where: { date },
        relations: ['session', 'requester', 'canteen', 'points'], order: { id: 'DESC' },
      });
    } else {
      list = await this.extras.find({
        relations: ['session', 'requester', 'canteen', 'points'], order: { id: 'DESC' }, take: 50,
      });
    }
    for (const e of list) await this.attachAgg(e);
    return list;
  }

  private async attachAgg(e: ExtraMeal) {
    const pts = e.points || await this.points.find({ where: { extraMealId: e.id } });
    const pk = await this.extraPickups.find({ where: { extraMealId: e.id } });
    (e as any).sentTotal = pts.reduce((a, p) => a + (p.sentCount || 0), 0);
    (e as any).receivedTotal = pts.reduce((a, p) => a + (p.receivedCount || 0), 0);
    (e as any).remainingTotal = pts.reduce((a, p) => a + Math.max(p.sentCount - p.receivedCount, 0), 0);
    (e as any).pickupTotal = pk.length;
    (e as any).money = pk.reduce((a, p) => ({
      worker: a.worker + Number(p.workerSubsidy), company: a.company + Number(p.companySubsidy), self: a.self + Number(p.selfPay),
    }), { worker: 0, company: 0, self: 0 });
  }

  async detail(id: number) {
    const e = await this.extras.findOne({
      where: { id },
      relations: ['session', 'requester', 'canteen', 'points', 'points.team', 'pickups', 'pickups.worker', 'pickups.team', 'pickups.point'],
    });
    if (!e) throw new NotFoundException('加餐单不存在');
    await this.attachAgg(e);
    // 漏领预警：已签收点中仍有剩余
    (e as any).missedPoints = (e.points || [])
      .filter((p) => p.status === 'received' && p.sentCount - p.receivedCount > 0)
      .map((p) => ({ id: p.id, pointName: p.pointName, remaining: p.sentCount - p.receivedCount, receiver: p.receiver }));
    return e;
  }

  /** 班组长发起加餐：跑四项检查，通过才落库；高风险点进入待安全员确认 */
  async create(dto: { sessionId: number; reason?: string; requestedCount: number; menu?: string; points: PointInput[] }, user: { sub: number }) {
    const check = await this.precheck({
      sessionId: dto.sessionId, requestedCount: dto.requestedCount,
      pointNames: (dto.points || []).map((p) => p.pointName),
    });
    if (!check.pass) {
      throw new BadRequestException({
        message: '加餐前置检查未通过',
        checks: check.checks.filter((c) => !c.pass).map((c) => `${c.label}：${c.msg}`),
      });
    }
    const session = await this.sessions.findOne({ where: { id: dto.sessionId } });
    const highRisk = check.highRisk;
    const e = this.extras.create({
      sessionId: dto.sessionId, canteenId: session.canteenId, requesterId: user.sub,
      date: session.date, reason: dto.reason || '夜间混凝土浇筑加班', requestedCount: check.confirmedCount,
      confirmedCount: check.confirmedCount, menu: dto.menu || '夜班加餐：热粥、肉包、卤蛋',
      price: check.rule.price, workerSubsidy: check.rule.workerSubsidy,
      companySubsidy: check.rule.companySubsidy, selfPay: check.rule.selfPay,
      highRisk, status: highRisk ? 'pending_safety' : 'ready',
    });
    const saved = await this.extras.save(e);

    // 按申请配送点拆分份数（默认均分，余数补到第一个点），可随后在配送时调整
    const pts = dto.points || [];
    const n = pts.length;
    const base = Math.floor(saved.confirmedCount / n);
    let rem = saved.confirmedCount - base * n;
    for (const p of pts) {
      const sent = base + (rem > 0 ? 1 : 0); if (rem > 0) rem--;
      await this.points.save(this.points.create({
        extraMealId: saved.id, teamId: p.teamId || null, pointName: p.pointName.trim(),
        route: p.route || '', stayMinutes: p.stayMinutes ?? null,
        sentCount: p.sentCount ?? sent, status: 'pending',
      }));
    }
    return this.detail(saved.id);
  }

  /** 安全员确认高风险配送点的路线与停留时间 */
  async safetyConfirm(id: number, dto: { safetyNote?: string; points?: Array<{ id: number; route: string; stayMinutes: number }> }, user: { sub: number }) {
    const e = await this.extras.findOne({ where: { id }, relations: ['points'] });
    if (!e) throw new NotFoundException('加餐单不存在');
    for (const p of dto.points || []) {
      const row = e.points.find((x) => x.id === p.id);
      if (row) {
        row.route = p.route || row.route;
        row.stayMinutes = p.stayMinutes ?? row.stayMinutes;
        await this.points.save(row);
      }
    }
    e.safetyNote = dto.safetyNote || '安全员已确认送餐路线与停留时间（高风险作业区）';
    e.safetyUserId = user.sub;
    e.safetyConfirmedAt = new Date();
    e.status = 'ready';
    await this.extras.save(e);
    return this.detail(id);
  }

  /** 食堂确认备餐：扣减食材余量，进入可配送 */
  async canteenConfirm(id: number, user: { sub: number }) {
    const e = await this.extras.findOne({ where: { id } });
    if (!e) throw new NotFoundException('加餐单不存在');
    if (e.status !== 'ready') throw new BadRequestException('当前状态不可确认备餐（高风险点需先经安全员确认）');
    const canteen = await this.canteens.findOne({ where: { id: e.canteenId } });
    if ((canteen?.ingredientStock || 0) < e.confirmedCount) throw new BadRequestException('食材余量不足');
    canteen.ingredientStock = canteen.ingredientStock - e.confirmedCount;
    await this.canteens.save(canteen);
    e.canteenUserId = user.sub; e.canteenConfirmedAt = new Date(); e.status = 'confirmed';
    await this.extras.save(e);
    return this.detail(id);
  }

  /** 配送出发：登记路线/停留/份数，点位置 delivered */
  async departPoint(pointId: number, dto: { route?: string; stayMinutes?: number; sentCount?: number }) {
    const p = await this.points.findOne({ where: { id: pointId } });
    if (!p) throw new NotFoundException('配送点不存在');
    if (dto.route !== undefined) p.route = dto.route;
    if (dto.stayMinutes !== undefined) p.stayMinutes = dto.stayMinutes;
    if (dto.sentCount !== undefined) p.sentCount = Math.max(0, Math.floor(dto.sentCount));
    p.status = 'delivered';
    await this.points.save(p);
    const e = await this.extras.findOne({ where: { id: p.extraMealId } });
    if (e && e.status === 'confirmed') { e.status = 'delivering'; await this.extras.save(e); }
    return this.detail(p.extraMealId);
  }

  /**
   * 施工点签收：签收人、温度、剩余数量、送达照片。
   * remainingCount 为正即触发漏领预警，全部点签收后加餐单置 received。
   */
  async receivePoint(pointId: number, dto: { receiver: string; receiverPhone?: string; temp: number; receivedCount?: number; photo?: string }) {
    const p = await this.points.findOne({ where: { id: pointId }, relations: ['extraMeal'] });
    if (!p) throw new NotFoundException('配送点不存在');
    p.receiver = dto.receiver; p.receiverPhone = dto.receiverPhone || '';
    p.temp = dto.temp; p.photo = dto.photo || p.photo;
    p.arrivedAt = new Date();
    p.receivedCount = Math.min(Math.max(0, Math.floor(dto.receivedCount ?? p.sentCount)), p.sentCount);
    p.remainingCount = p.sentCount - p.receivedCount;
    p.status = 'received';
    await this.points.save(p);

    const all = await this.points.find({ where: { extraMealId: p.extraMealId } });
    if (all.every((x) => x.status === 'received')) {
      const e = await this.extras.findOne({ where: { id: p.extraMealId } });
      e.status = 'received'; await this.extras.save(e);
    }
    return this.detail(p.extraMealId);
  }

  /**
   * 工人在某施工点领取加餐：夜间加班加餐企业全额承担；
   * 同时写入夜宵餐次取餐流水（operator=夜间加餐），使费用与领取人员归入当晚餐次。
   */
  async pickup(dto: { extraMealId: number; pointId?: number; workerId?: number; code?: string; method?: string }) {
    const e = await this.extras.findOne({ where: { id: dto.extraMealId } });
    if (!e) throw new NotFoundException('加餐单不存在');
    if (!['confirmed', 'delivering', 'received'].includes(e.status)) throw new BadRequestException('加餐尚未确认备餐，暂不可领取');

    let worker = null;
    if (dto.workerId) worker = await this.workers.findOne({ where: { id: dto.workerId }, relations: ['team'] });
    else if (dto.code) worker = await this.workers.findOne({ where: { pickupCode: dto.code }, relations: ['team'] });
    if (!worker) throw new NotFoundException('未识别到工人');

    const dup = await this.extraPickups.findOne({ where: { extraMealId: e.id, workerId: worker.id } });
    if (dup) throw new BadRequestException('该工人已领取本次加餐，请勿重复领取');

    let point = null;
    if (dto.pointId) point = await this.points.findOne({ where: { id: dto.pointId } });
    if (point) {
      if (point.receivedCount >= point.sentCount) throw new BadRequestException(`「${point.pointName}」已领完`);
      point.receivedCount += 1; point.remainingCount = point.sentCount - point.receivedCount;
      await this.points.save(point);
    }

    const rec = await this.extraPickups.save(this.extraPickups.create({
      extraMealId: e.id, pointId: point?.id || null, workerId: worker.id, teamId: worker.teamId,
      method: dto.method || 'face',
      price: e.price, workerSubsidy: e.workerSubsidy, companySubsidy: e.companySubsidy, selfPay: e.selfPay,
      operator: '夜间加餐',
    }));

    // 归入夜宵餐次：写一条取餐流水（与加餐同费），用于餐次/月度费用与领取人员统计
    await this.pickups.save(this.pickups.create({
      sessionId: e.sessionId, workerId: worker.id, teamId: worker.teamId,
      method: dto.method || 'face', crossTeam: false, unverified: !worker.verified,
      price: e.price, workerSubsidy: e.workerSubsidy, companySubsidy: e.companySubsidy, selfPay: e.selfPay,
      operator: '夜间加餐',
    }));

    return this.extraPickups.findOne({ where: { id: rec.id }, relations: ['worker', 'team', 'point'] });
  }
}
