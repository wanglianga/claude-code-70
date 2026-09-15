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

    // 配送点份数：显式提供时校验总和不得超过确认份数；未提供则均分预分配（出发时才生效）
    const pts = (dto.points || []).map((p) => ({ ...p, pointName: (p.pointName || '').trim() }));
    const n = pts.length;
    const explicit = pts.filter((p) => p.sentCount !== undefined && p.sentCount !== null);
    if (explicit.length) {
      const sum = explicit.reduce((a, p) => a + Math.max(0, Math.floor(Number(p.sentCount) || 0)), 0);
      if (sum > saved.confirmedCount) {
        throw new BadRequestException(`配送点份数之和 ${sum} 超过加餐确认份数 ${saved.confirmedCount}`);
      }
    }
    const base = Math.floor(saved.confirmedCount / n);
    let rem = saved.confirmedCount - base * n;
    for (const p of pts) {
      const sent = p.sentCount !== undefined && p.sentCount !== null
        ? Math.max(0, Math.floor(Number(p.sentCount)))
        : base + (rem > 0 ? 1 : 0);
      if (p.sentCount === undefined || p.sentCount === null) { if (rem > 0) rem--; }
      await this.points.save(this.points.create({
        extraMealId: saved.id, teamId: p.teamId || null, pointName: p.pointName,
        route: p.route || '', stayMinutes: p.stayMinutes ?? null,
        sentCount: sent, status: 'pending',
      }));
    }
    return this.detail(saved.id);
  }

  /** 安全员确认高风险配送点的路线与停留时间（每个点都必须有有效路线和正数停留时间） */
  async safetyConfirm(id: number, dto: { safetyNote?: string; points?: Array<{ id: number; route: string; stayMinutes: number }> }, user: { sub: number }) {
    const e = await this.extras.findOne({ where: { id }, relations: ['points'] });
    if (!e) throw new NotFoundException('加餐单不存在');
    if (!e.highRisk) throw new BadRequestException('该加餐不含高风险作业区，无需安全员确认');
    if (!['pending_safety', 'ready'].includes(e.status)) throw new BadRequestException('当前状态不可进行安全确认');

    const submitted = new Map<number, { route?: string; stayMinutes?: number }>(
      (dto.points || []).map((p) => [p.id, p]),
    );
    // 每个配送点都必须有：非空有效路线 + 正数停留时间（分钟）
    const errors: string[] = [];
    for (const p of e.points) {
      const s = submitted.get(p.id);
      const route = (s?.route ?? p.route ?? '').toString().trim();
      const stay = Number(s?.stayMinutes ?? p.stayMinutes ?? 0);
      if (!route) errors.push(`「${p.pointName}」缺少有效送餐路线`);
      if (!Number.isFinite(stay) || stay <= 0) errors.push(`「${p.pointName}」停留时间必须为正数（分钟）`);
    }
    if (errors.length) throw new BadRequestException({ message: '安全确认资料不完整', errors });

    // 全部校验通过后才写库
    for (const p of e.points) {
      const s = submitted.get(p.id);
      if (s) {
        if (s.route !== undefined) p.route = s.route.trim();
        if (s.stayMinutes !== undefined) p.stayMinutes = Math.floor(Number(s.stayMinutes));
        await this.points.save(p);
      }
    }
    e.safetyNote = (dto.safetyNote || '安全员已确认送餐路线与停留时间（高风险作业区）').trim();
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

  /** 配送出发：登记路线/停留/份数；已出发各点送达份数之和不得超过加餐确认份数 */
  async departPoint(pointId: number, dto: { route?: string; stayMinutes?: number; sentCount?: number }) {
    const p = await this.points.findOne({ where: { id: pointId }, relations: ['extraMeal'] });
    if (!p) throw new NotFoundException('配送点不存在');
    const e = p.extraMeal;
    if (!['confirmed', 'delivering'].includes(e.status)) {
      throw new BadRequestException('食堂尚未确认备餐，暂不能出发配送');
    }
    const nextSent = dto.sentCount !== undefined ? Math.max(0, Math.floor(Number(dto.sentCount))) : p.sentCount;
    if (!Number.isFinite(nextSent)) throw new BadRequestException('送达份数必须为非负整数');
    if (nextSent <= 0) throw new BadRequestException('送达份数必须大于 0');
    // 仅汇总已实际出发(delivered/received)的点，pending 点尚未送出不计；再加上本次
    const others = await this.points.find({ where: { extraMealId: p.extraMealId } });
    const committed = others
      .filter((x) => x.id !== p.id && x.status !== 'pending')
      .reduce((a, x) => a + (x.sentCount || 0), 0);
    if (committed + nextSent > e.confirmedCount) {
      throw new BadRequestException(`各配送点送达份数之和 ${committed + nextSent} 超过加餐确认份数 ${e.confirmedCount}，请调整`);
    }
    if (dto.route !== undefined) p.route = dto.route;
    if (dto.stayMinutes !== undefined) p.stayMinutes = dto.stayMinutes;
    p.sentCount = nextSent;
    p.status = 'delivered';
    await this.points.save(p);
    if (e.status === 'confirmed') { e.status = 'delivering'; await this.extras.save(e); }
    return this.detail(p.extraMealId);
  }

  /**
   * 施工点签收：必须填写签收人、有效餐食温度、送达照片，缺任一返回 400 且状态不变。
   * remainingCount 为正即触发漏领预警，全部点签收后加餐单置 received。
   */
  async receivePoint(pointId: number, dto: { receiver: string; receiverPhone?: string; temp: number; receivedCount?: number; photo?: string }) {
    const p = await this.points.findOne({ where: { id: pointId }, relations: ['extraMeal'] });
    if (!p) throw new NotFoundException('配送点不存在');

    // 资料完整性校验（在任何写入之前）
    const errors: string[] = [];
    const receiver = (dto.receiver ?? '').toString().trim();
    if (!receiver) errors.push('签收人不能为空');
    const temp = Number(dto.temp);
    if (dto.temp === undefined || dto.temp === null || !Number.isFinite(temp) || temp <= 0 || temp > 100) {
      errors.push('餐食温度必须为有效数值（0-100℃）');
    }
    const photo = (dto.photo ?? '').toString().trim();
    if (!photo) errors.push('送达照片不能为空');
    if (p.status === 'pending') errors.push('该配送点尚未出发送达，不能签收');
    if ((p.sentCount || 0) <= 0) errors.push('该配送点送达份数为0，不能签收');
    let received = dto.receivedCount === undefined || dto.receivedCount === null ? p.sentCount : Math.floor(Number(dto.receivedCount));
    if (!Number.isFinite(received) || received < 0 || received > p.sentCount) {
      errors.push(`签收份数必须在 0-${p.sentCount} 之间`);
    }
    if (errors.length) throw new BadRequestException({ message: '签收资料不完整', errors });

    // 校验通过后才写库（保证缺资料时状态不变）
    p.receiver = receiver; p.receiverPhone = dto.receiverPhone || '';
    p.temp = temp; p.photo = photo;
    p.arrivedAt = new Date();
    p.receivedCount = received;
    p.remainingCount = p.sentCount - received;
    p.status = 'received';
    await this.points.save(p);

    const all = await this.points.find({ where: { extraMealId: p.extraMealId } });
    if (all.every((x) => x.status === 'received')) {
      const ex = await this.extras.findOne({ where: { id: p.extraMealId } });
      ex.status = 'received'; await this.extras.save(ex);
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
