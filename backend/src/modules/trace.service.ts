import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TraceEvent } from '../entities/trace-event.entity';
import { DiscomfortReport } from '../entities/discomfort-report.entity';
import { ContactPerson } from '../entities/contact-person.entity';
import { SampleSubmission } from '../entities/sample-submission.entity';
import { BatchUsage } from '../entities/batch-usage.entity';
import { RectificationTask } from '../entities/rectification-task.entity';
import { TraceAction } from '../entities/trace-action.entity';
import { Supplier } from '../entities/supplier.entity';
import { SupplierFoodEvent } from '../entities/supplier-food-event.entity';
import { MealSession } from '../entities/meal-session.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { MealPreparation } from '../entities/meal-preparation.entity';
import { FoodSample } from '../entities/food-sample.entity';
import { Worker } from '../entities/worker.entity';
import { Team } from '../entities/team.entity';

interface AuthUser { sub: number; role: string; name?: string }

export const SYMPTOM_LABELS: Record<string, string> = {
  abdominal_pain: '腹痛', vomiting: '呕吐', diarrhea: '腹泻', fever: '发热', nausea: '恶心', dizziness: '头晕',
};
const MEDICAL_LABELS: Record<string, string> = {
  none: '未就医', outpatient: '门诊', inpatient: '住院', observation: '现场医务观察',
};

/** 一键生成的标准整改任务包（类别/标题/责任角色/说明） */
const TASK_PACKAGE: Array<{ category: string; title: string; role: string; detail: string; dueHours: number }> = [
  { category: 'seal', title: '封存涉事食材与同批次库存', role: 'CANTEEN', detail: '立即封存涉事菜品、同批次食材及半成品，上锁挂牌，禁止继续加工使用。', dueHours: 4 },
  { category: 'recall', title: '排查并追回同批次已加工餐品', role: 'CANTEEN', detail: '核对同批食材使用餐次，已送出餐品通知停餐，剩余餐品销毁登记。', dueHours: 8 },
  { category: 'disinfect', title: '操作间/餐具/留样冰箱全面消毒', role: 'CANTEEN', detail: '对加工区、刀具砧板、餐具、留样冰箱进行彻底清洗消毒并记录。', dueHours: 24 },
  { category: 'supplier', title: '供应商整改并提供批次合格证明', role: 'PROJECT', detail: '向涉事供应商发出整改通知，暂停供料期间要求提供检测合格证明与整改报告。', dueHours: 48 },
  { category: 'retrain', title: '食堂从业人员食品安全再培训', role: 'SAFETY', detail: '组织厨师与分餐人员开展食品留样、生熟分开、烧熟煮透专项培训并考核。', dueHours: 72 },
  { category: 'other', title: '完成不适工人持续回访至全部康复', role: 'FOREMAN', detail: '对同餐次人员逐人回访，不适人员跟踪至康复，住院人员对接医保与工伤申报。', dueHours: 48 },
];

@Injectable()
export class TraceService {
  private readonly logger = new Logger('Trace');
  constructor(
    @InjectRepository(TraceEvent) private events: Repository<TraceEvent>,
    @InjectRepository(DiscomfortReport) private reports: Repository<DiscomfortReport>,
    @InjectRepository(ContactPerson) private contacts: Repository<ContactPerson>,
    @InjectRepository(SampleSubmission) private submissions: Repository<SampleSubmission>,
    @InjectRepository(BatchUsage) private usages: Repository<BatchUsage>,
    @InjectRepository(RectificationTask) private tasks: Repository<RectificationTask>,
    @InjectRepository(TraceAction) private actions: Repository<TraceAction>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(SupplierFoodEvent) private supplierEvents: Repository<SupplierFoodEvent>,
    @InjectRepository(MealSession) private sessions: Repository<MealSession>,
    @InjectRepository(MealPickup) private pickups: Repository<MealPickup>,
    @InjectRepository(MealPreparation) private preps: Repository<MealPreparation>,
    @InjectRepository(FoodSample) private samples: Repository<FoodSample>,
    @InjectRepository(Worker) private workers: Repository<Worker>,
    @InjectRepository(Team) private teams: Repository<Team>,
  ) {}

  // ---------------------------------------------------------------- 事件
  async list(status?: string) {
    return this.events.find({
      where: status ? { status } : {},
      relations: ['session', 'supplier', 'reporter'],
      order: { id: 'DESC' },
    });
  }

  async detail(id: number) {
    const ev = await this.events.findOne({
      where: { id },
      relations: [
        'session', 'supplier', 'reporter',
        'reports', 'reports.worker', 'reports.team', 'reports.recorder',
        'contacts', 'contacts.team',
        'submissions', 'submissions.sample', 'submissions.operator',
        'batchUsages', 'batchUsages.session',
        'tasks', 'tasks.assignee',
        'actions', 'actions.actor',
      ],
    } as any);
    if (!ev) throw new NotFoundException('追溯事件不存在');
    return ev;
  }

  private async nextCode(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const prefix = `TRACE-${ymd}-`;
    const todays = await this.events
      .createQueryBuilder('e')
      .where('e.code LIKE :p', { p: `${prefix}%` })
      .getCount();
    return `${prefix}${String(todays + 1).padStart(2, '0')}`;
  }

  async create(dto: any, user: AuthUser) {
    if (!dto.title) throw new BadRequestException('请填写事件标题');
    let mealTime: Date | null = null;
    if (dto.mealTime) mealTime = new Date(dto.mealTime);

    // 自动带出餐次备餐的供应商与食材批次
    let supplierId = dto.supplierId ? +dto.supplierId : null;
    let ingredientBatch = dto.ingredientBatch || null;
    let teamNames = dto.teamNames || '';
    if (dto.sessionId) {
      // 同一餐次理论上一条备餐主记录；若存在历史演示记录则取最早的主备餐
      const prep = await this.preps.findOne({
        where: { sessionId: +dto.sessionId }, order: { id: 'ASC' },
      });
      if (prep) {
        if (!supplierId) supplierId = prep.supplierId;
        if (!ingredientBatch) ingredientBatch = prep.ingredientBatch;
      }
      if (!teamNames) {
        const rows = await this.pickups.find({
          where: { sessionId: +dto.sessionId }, relations: ['team'], take: 500,
        });
        teamNames = [...new Set(rows.map((r) => r.team?.name).filter(Boolean))].join('、');
      }
    }

    const ev = await this.events.save(this.events.create({
      code: await this.nextCode(),
      title: dto.title,
      description: dto.description || '',
      severity: dto.severity || 'high',
      mealTime,
      dishes: dto.dishes || '',
      teamNames,
      sampleBoxNos: dto.sampleBoxNos || '',
      sessionId: dto.sessionId ? +dto.sessionId : null,
      ingredientBatch, supplierId,
      reporterId: user.sub,
      status: 'investigating',
    }));
    await this.log(ev.id, 'create', `建档追溯事件：${ev.title}（取餐时间 ${mealTime ? this.fmt(mealTime) : '未填'}，涉事菜品 ${ev.dishes || '—'}）`, user);
    return this.detail(ev.id);
  }

  async comment(id: number, dto: { content: string }, user: AuthUser) {
    await this.requireEvent(id);
    if (!dto.content) throw new BadRequestException('请填写内容');
    await this.log(id, 'comment', dto.content, user);
    return this.detail(id);
  }

  // ---------------------------------------------------------------- 个案报告
  async addReport(id: number, dto: any, user: AuthUser) {
    const ev = await this.requireEvent(id);
    let worker: Worker | null = null;
    let teamId = dto.teamId ? +dto.teamId : null;
    let workerName = dto.workerName || '';
    if (dto.workerId) {
      worker = await this.workers.findOne({ where: { id: +dto.workerId } });
      if (!worker) throw new NotFoundException('工人不存在');
      workerName = worker.name;
      teamId = worker.teamId;
    }
    if (!workerName) throw new BadRequestException('请填写工人姓名');

    const symptoms = this.normList(dto.symptoms);
    const report = await this.reports.save(this.reports.create({
      traceEventId: id,
      workerId: worker?.id || null,
      workerName,
      teamId,
      symptoms: symptoms.join(','),
      onsetAt: dto.onsetAt ? new Date(dto.onsetAt) : null,
      pickupAt: dto.pickupAt ? new Date(dto.pickupAt) : (ev.mealTime || null),
      dishes: dto.dishes || ev.dishes,
      sampleBoxNo: dto.sampleBoxNo || null,
      medicalStatus: dto.medicalStatus || 'none',
      hospital: dto.hospital || null,
      diagnosis: dto.diagnosis || null,
      visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : null,
      medicalNote: dto.medicalNote || '',
      status: ['inpatient', 'observation'].includes(dto.medicalStatus) ? 'following' : 'reported',
      recorderId: user.sub,
    }));

    // 汇总到事件头：菜品 / 留样编号 / 班组名
    const all = await this.reports.find({ where: { traceEventId: id }, relations: ['team'] });
    ev.dishes = [...new Set(all.flatMap((r) => r.dishes.split(/[,，、]/)).map((s) => s.trim()).filter(Boolean))].join('、');
    const boxes = [...new Set(all.map((r) => r.sampleBoxNo).filter(Boolean))];
    ev.sampleBoxNos = [...new Set([...ev.sampleBoxNos.split(/[,，、\s]/).filter(Boolean), ...boxes])].join('、');
    ev.teamNames = [...new Set(all.map((r) => r.team?.name).filter(Boolean))].join('、') || ev.teamNames;
    if (all.length >= 2 && ev.status === 'investigating') ev.severity = 'high';
    await this.events.save(ev);

    // 已有同餐次名单则自动标记症状人员
    const cp = worker
      ? await this.contacts.findOne({ where: { traceEventId: id, workerId: worker.id } })
      : await this.contacts.findOne({ where: { traceEventId: id, workerName } });
    if (cp) {
      cp.symptomatic = true;
      if (report.medicalStatus === 'inpatient') cp.observeStatus = 'confirmed_sick';
      await this.contacts.save(cp);
    }

    const med = MEDICAL_LABELS[report.medicalStatus] || report.medicalStatus;
    await this.log(
      id, 'report',
      `个案报告：${workerName}｜症状 ${symptoms.map((s) => SYMPTOM_LABELS[s] || s).join('、') || '—'}｜就医 ${med}`
        + `${report.hospital ? `（${report.hospital}${report.diagnosis ? `/${report.diagnosis}` : ''}）` : ''}`,
      user,
    );
    return { event: await this.detail(id), report };
  }

  async updateReportMedical(id: number, reportId: number, dto: any, user: AuthUser) {
    const r = await this.reports.findOne({ where: { id: reportId, traceEventId: id } });
    if (!r) throw new NotFoundException('个案报告不存在');
    Object.assign(r, {
      medicalStatus: dto.medicalStatus ?? r.medicalStatus,
      hospital: dto.hospital ?? r.hospital,
      diagnosis: dto.diagnosis ?? r.diagnosis,
      visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : r.visitedAt,
      medicalNote: dto.medicalNote ?? r.medicalNote,
      status: dto.status ?? (dto.medicalStatus === 'inpatient' ? 'following' : r.status),
    });
    await this.reports.save(r);
    await this.log(id, 'report', `更新就医记录：${r.workerName} → ${MEDICAL_LABELS[r.medicalStatus] || r.medicalStatus}${r.hospital ? `（${r.hospital}）` : ''}`, user);
    return this.detail(id);
  }

  // ---------------------------------------------------------------- 同餐次名单 / 通知 / 回访停餐
  /**
   * 从取餐流水生成同餐次人员名单（幂等）。
   * 名单用于：① 通知同餐次人员 ② 停餐观察 ③ 逐人回访。
   */
  async buildContacts(id: number, user: AuthUser) {
    const ev = await this.requireEvent(id);
    if (!ev.sessionId) throw new BadRequestException('该事件未关联餐次，无法自动生成名单');
    const pickups = await this.pickups.find({
      where: { sessionId: ev.sessionId },
      relations: ['worker', 'team'],
      order: { id: 'ASC' },
    });
    const symptomaticNames = new Set((await this.reports.find({ where: { traceEventId: id } })).map((r) => r.workerName));
    let created = 0;
    for (const p of pickups) {
      const exists = await this.contacts.findOne({ where: { traceEventId: id, workerId: p.workerId } });
      if (exists) continue;
      await this.contacts.save(this.contacts.create({
        traceEventId: id,
        workerId: p.workerId,
        workerName: p.worker?.name || `工人#${p.workerId}`,
        teamId: p.teamId,
        phone: p.worker?.phone || null,
        pickupMethod: p.method,
        pickupAt: p.createdAt,
        symptomatic: symptomaticNames.has(p.worker?.name),
      }));
      created++;
    }
    await this.log(id, 'notify', `生成同餐次人员名单：本餐次取餐 ${pickups.length} 人，新增 ${created} 人，纳入回访与停餐观察范围`, user);
    return this.detail(id);
  }

  /** 通知同餐次人员（可批量），并可同时下发停餐观察 */
  async notifyContacts(id: number, dto: { ids?: number[]; channel?: string; suspendMeal?: boolean; observeHours?: number; content?: string }, user: AuthUser) {
    const ev = await this.requireEvent(id);
    const rows = dto.ids?.length
      ? await this.contacts.find({ where: { traceEventId: id, id: In(dto.ids) } })
      : await this.contacts.find({ where: { traceEventId: id } });
    if (!rows.length) throw new BadRequestException('名单为空，请先生成同餐次人员名单');
    const now = new Date();
    const observeUntil = dto.suspendMeal ? new Date(now.getTime() + (dto.observeHours || 48) * 3600e3) : null;
    for (const c of rows) {
      c.notifyStatus = 'notified';
      c.notifiedAt = now;
      c.notifyChannel = dto.channel || '电话+班组长转达';
      if (dto.suspendMeal && c.observeStatus === 'none') {
        c.observeStatus = c.symptomatic ? 'confirmed_sick' : 'observing';
        c.observeUntil = observeUntil;
      }
      await this.contacts.save(c);
    }
    ev.notified = true;
    if (dto.suspendMeal) ev.mealSuspended = true;
    await this.events.save(ev);
    await this.log(
      id, 'notify',
      `通知同餐次 ${rows.length} 人（${dto.channel || '电话+班组长转达'}）：留意腹痛呕吐症状、暂停供餐观察${dto.suspendMeal ? ` ${dto.observeHours || 48} 小时` : ''}，出现不适立即就医`,
      user,
    );
    return this.detail(id);
  }

  /** 逐人回访 + 停餐观察结果登记/解除 */
  async followUp(id: number, contactId: number, dto: { observeStatus?: string; followUpResult?: string; resume?: boolean }, user: AuthUser) {
    const c = await this.contacts.findOne({ where: { id: contactId, traceEventId: id } });
    if (!c) throw new NotFoundException('名单人员不存在');
    c.followUpResult = dto.followUpResult ?? c.followUpResult;
    c.followedAt = new Date();
    if (dto.observeStatus) c.observeStatus = dto.observeStatus;
    if (dto.resume) {
      c.observeStatus = 'resumed';
      c.observeUntil = null;
    }
    await this.contacts.save(c);
    await this.log(id, 'observe', `回访 ${c.workerName}：${c.followUpResult || '—'}｜观察状态 ${this.observeLabel(c.observeStatus)}`, user);
    return this.detail(id);
  }

  // ---------------------------------------------------------------- 供应商暂停/恢复
  async suspendSupplier(id: number, dto: { supplierId: number; reason?: string }, user: AuthUser) {
    const ev = await this.requireEvent(id);
    const sup = await this.suppliers.findOne({ where: { id: +dto.supplierId } });
    if (!sup) throw new NotFoundException('供应商不存在');
    sup.status = 'suspended';
    sup.suspendedAt = new Date();
    sup.suspendReason = dto.reason || '食品不适追溯调查期间暂停供料';
    sup.suspendTraceCode = ev.code;
    await this.suppliers.save(sup);
    ev.supplierId = sup.id;
    await this.events.save(ev);
    await this.supplierEvents.save(this.supplierEvents.create({
      supplierId: sup.id, type: 'suspension', title: `暂停供料（${ev.code}）`,
      content: sup.suspendReason, traceCode: ev.code,
    }));
    await this.log(id, 'suspend_supplier', `暂停供应商「${sup.name}」供料，待留样送检与整改验收合格后恢复`, user);
    return this.detail(id);
  }

  async resumeSupplier(id: number, dto: { note?: string }, user: AuthUser) {
    const ev = await this.requireEvent(id);
    if (!ev.supplierId) throw new BadRequestException('事件未关联供应商');
    const sup = await this.suppliers.findOne({ where: { id: ev.supplierId } });
    if (!sup) throw new NotFoundException('供应商不存在');
    sup.status = 'active';
    sup.suspendReason = '';
    sup.suspendTraceCode = null;
    sup.suspendedAt = null;
    await this.suppliers.save(sup);
    await this.supplierEvents.save(this.supplierEvents.create({
      supplierId: sup.id, type: 'resume', title: `恢复供料（${ev.code}）`,
      content: dto.note || '检测合格并完成整改验收，恢复供料', traceCode: ev.code,
    }));
    await this.log(id, 'resume_supplier', `供应商「${sup.name}」整改验收通过，恢复供料`, user);
    return this.detail(id);
  }

  // ---------------------------------------------------------------- 留样送检
  async submitSample(id: number, dto: any, user: AuthUser) {
    const ev = await this.requireEvent(id);
    let boxNo = dto.sampleBoxNo || null;
    let dishName = dto.dishName || '';
    if (dto.sampleId) {
      const sample = await this.samples.findOne({ where: { id: +dto.sampleId }, relations: ['preparation'] });
      if (!sample) throw new NotFoundException('留样不存在');
      if (sample.status === 'disposed') throw new BadRequestException('该留样已处置，无法送检');
      boxNo = sample.boxNo;
      dishName = sample.dishName;
      sample.status = 'testing';
      await this.samples.save(sample);
    }
    if (!dishName) throw new BadRequestException('请填写送检菜品');
    const sub = await this.submissions.save(this.submissions.create({
      traceEventId: id,
      sampleId: dto.sampleId ? +dto.sampleId : null,
      sampleBoxNo: boxNo,
      dishName,
      labName: dto.labName || null,
      labContact: dto.labContact || null,
      testItems: this.normList(dto.testItems).join('、'),
      sentAt: new Date(),
      sentBy: user.name,
      result: 'testing',
      operatorId: user.sub,
    }));
    ev.status = 'testing';
    if (boxNo && !ev.sampleBoxNos.split(/[,，、\s]/).includes(boxNo)) {
      ev.sampleBoxNos = [...ev.sampleBoxNos.split(/[,，、\s]/).filter(Boolean), boxNo].join('、');
    }
    await this.events.save(ev);
    await this.log(id, 'submit_sample', `留样送检：${dishName}（留样编号 ${boxNo || '—'}）→ ${sub.labName || '第三方检测机构'}，项目 ${sub.testItems || '常规微生物'}`, user);
    return this.detail(id);
  }

  /**
   * 登记送检结果：
   *  - 回写送检单与 food_samples 状态；
   *  - 不合格 → 同步供应商食安档案 + 建议扣款累计；
   *  - 全部有结果后事件进入整改阶段。
   */
  async recordLabResult(id: number, submissionId: number, dto: { result: string; labReport?: string; penaltyAmount?: number }, user: AuthUser) {
    const ev = await this.requireEvent(id);
    const sub = await this.submissions.findOne({ where: { id: submissionId, traceEventId: id }, relations: ['sample'] });
    if (!sub) throw new NotFoundException('送检单不存在');
    if (!['passed', 'failed'].includes(dto.result)) throw new BadRequestException('结果应为 passed/failed');
    sub.result = dto.result;
    sub.labReport = dto.labReport || sub.labReport;
    sub.resultedAt = new Date();
    await this.submissions.save(sub);

    if (sub.sample) {
      sub.sample.status = dto.result === 'passed' ? 'passed' : 'failed';
      sub.sample.labResult = dto.labReport || sub.sample.labResult;
      await this.samples.save(sub.sample);
    }

    const sup = ev.supplierId ? await this.suppliers.findOne({ where: { id: ev.supplierId } }) : null;
    if (sup && !sub.syncedToSupplier) {
      await this.supplierEvents.save(this.supplierEvents.create({
        supplierId: sup.id,
        type: dto.result === 'passed' ? 'lab_pass' : 'lab_fail',
        title: `${sub.dishName} 留样检测${dto.result === 'passed' ? '合格' : '不合格'}（${ev.code}）`,
        content: dto.labReport || sub.testItems,
        traceCode: ev.code,
        sampleBoxNo: sub.sampleBoxNo,
        dishName: sub.dishName,
      }));
      sub.syncedToSupplier = true;
      await this.submissions.save(sub);

      if (dto.result === 'failed') {
        const penalty = +(dto.penaltyAmount ?? 0);
        if (penalty > 0) {
          sup.deduction = +(sup.deduction + penalty).toFixed(2);
          await this.suppliers.save(sup);
          await this.supplierEvents.save(this.supplierEvents.create({
            supplierId: sup.id, type: 'penalty', title: `追责扣款 ¥${penalty}（${ev.code}）`,
            content: `留样「${sub.dishName}」检测不合格，按食品安全协议扣款`, traceCode: ev.code, amount: penalty,
          }));
          ev.penaltyAmount = +(Number(ev.penaltyAmount) + penalty).toFixed(2);
        }
        ev.responsibleParty = sup.name;
      }
    }

    // 全部送检均有结论 → 进入整改阶段
    const pending = await this.submissions.count({ where: { traceEventId: id, result: In(['pending', 'testing']) } });
    if (pending === 0) ev.status = 'rectifying';
    await this.events.save(ev);

    await this.log(
      id, 'lab_result',
      `送检结果：${sub.dishName}（${sub.sampleBoxNo || '—'}）${dto.result === 'passed' ? '检测合格' : '检测不合格'}`
        + `${dto.labReport ? `｜${dto.labReport}` : ''}${sup ? `｜已同步供应商「${sup.name}」食安档案` : ''}`,
      user,
    );
    return this.detail(id);
  }

  // ---------------------------------------------------------------- 同批食材去向
  /**
   * 扫描同批食材：按批次号查其他备餐记录 → 餐次 → 取餐人数，
   * 记录同批食材是否已用于其他餐次，明确供应商追责范围。
   */
  async scanBatch(id: number, dto: { ingredientBatch?: string }, user: AuthUser) {
    const ev = await this.requireEvent(id);
    const batch = (dto.ingredientBatch || ev.ingredientBatch || '').trim();
    if (!batch) throw new BadRequestException('请先填写食材批次号');

    const preps = await this.preps.find({
      where: { ingredientBatch: batch },
      relations: ['session'],
      order: { id: 'ASC' },
    });
    // 清掉旧的扫描结果重新生成（保留手工研判字段会丢——因此扫描前先删自动行）
    await this.usages.delete({ traceEventId: id });

    let exposedOther = 0;
    for (const p of preps) {
      const exposedCount = await this.pickups.count({ where: { sessionId: p.sessionId } });
      const isCurrent = p.sessionId === ev.sessionId;
      await this.usages.save(this.usages.create({
        traceEventId: id,
        ingredientBatch: batch,
        sessionId: p.sessionId,
        preparationId: p.id,
        dishName: p.menu.length > 40 ? `${p.menu.slice(0, 40)}…` : p.menu,
        usedCount: p.preparedCount || exposedCount,
        status: 'used',
        exposed: !isCurrent && exposedCount > 0,
        riskNote: isCurrent
          ? '涉事餐次（本事件）'
          : exposedCount > 0
            ? `同批食材已用于该餐次，约 ${exposedCount} 人取餐，纳入追责与回访范围`
            : '该餐次暂无取餐流水',
      }));
      if (!isCurrent && exposedCount > 0) exposedOther++;
    }
    ev.ingredientBatch = batch;
    await this.events.save(ev);
    await this.log(
      id, 'batch_scan',
      `同批食材「${batch}」追溯：命中备餐 ${preps.length} 条，其中 ${exposedOther} 个其他餐次已供餐取餐，供应商追责范围以受影响餐次为准`,
      user,
    );
    return this.detail(id);
  }

  async setBatchUsage(id: number, usageId: number, dto: { status?: string; exposed?: boolean; riskNote?: string }, user: AuthUser) {
    const u = await this.usages.findOne({ where: { id: usageId, traceEventId: id } });
    if (!u) throw new NotFoundException('批次用途记录不存在');
    if (dto.status) u.status = dto.status;
    if (dto.exposed !== undefined) u.exposed = dto.exposed;
    if (dto.riskNote !== undefined) u.riskNote = dto.riskNote;
    await this.usages.save(u);
    await this.log(id, 'batch_scan', `同批去向更新：${u.ingredientBatch} → ${u.status === 'sealed' ? '已封存' : u.status === 'discarded' ? '已销毁' : '已使用'}（${u.riskNote || '—'}）`, user);
    return this.detail(id);
  }

  // ---------------------------------------------------------------- 整改任务
  async createTask(id: number, dto: any, user: AuthUser) {
    await this.requireEvent(id);
    if (!dto.title) throw new BadRequestException('请填写整改任务标题');
    let assigneeId = dto.assigneeId ? +dto.assigneeId : null;
    let assigneeName = dto.assigneeName || null;
    if (!assigneeId && dto.assigneeName) {
      // 允许直接给角色名占位
    }
    const t = await this.tasks.save(this.tasks.create({
      traceEventId: id,
      title: dto.title,
      detail: dto.detail || null,
      category: dto.category || 'other',
      assigneeId,
      assigneeName,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      status: 'open',
    }));
    await this.log(id, 'task_create', `生成安全整改任务：${t.title}（责任人 ${assigneeName || '待派单'}${t.dueAt ? `，期限 ${this.fmt(t.dueAt)}` : ''}）`, user);
    return this.detail(id);
  }

  /** 一键生成标准整改任务包（幂等：同标题不重复生成） */
  async generateTaskPackage(id: number, user: AuthUser) {
    const ev = await this.requireEvent(id);
    const existing = await this.tasks.find({ where: { traceEventId: id } });
    let n = 0;
    for (const tp of TASK_PACKAGE) {
      if (existing.some((t) => t.title === tp.title)) continue;
      await this.tasks.save(this.tasks.create({
        traceEventId: id,
        title: tp.title,
        detail: tp.detail,
        category: tp.category,
        assigneeName: this.roleName(tp.role),
        dueAt: new Date(Date.now() + tp.dueHours * 3600e3),
        status: 'open',
      }));
      n++;
    }
    await this.log(id, 'task_create', `一键生成安全整改任务 ${n} 项（封存食材、同批追回、环境消毒、供应商整改、人员培训、持续回访）`, user);
    if (ev.status === 'investigating') ev.status = 'rectifying';
    await this.events.save(ev);
    return this.detail(id);
  }

  async updateTask(id: number, taskId: number, dto: any, user: AuthUser) {
    const t = await this.tasks.findOne({ where: { id: taskId, traceEventId: id }, relations: ['assignee'] });
    if (!t) throw new NotFoundException('整改任务不存在');
    if (dto.title) t.title = dto.title;
    if (dto.detail !== undefined) t.detail = dto.detail;
    if (dto.assigneeId) t.assigneeId = +dto.assigneeId;
    if (dto.assigneeName !== undefined) t.assigneeName = dto.assigneeName;
    if (dto.dueAt) t.dueAt = new Date(dto.dueAt);
    if (dto.status === 'done') {
      t.status = 'done';
      t.finishedAt = new Date();
      t.result = dto.result || t.result;
      await this.log(id, 'task_done', `整改完成：${t.title}（${t.result || '已整改'}）`, user);
    } else if (dto.status === 'verified') {
      t.status = 'verified';
      t.verifiedAt = new Date();
      await this.log(id, 'task_verify', `整改验收通过：${t.title}`, user);
    } else if (dto.status === 'open') {
      t.status = 'open';
      t.finishedAt = null;
    }
    await this.tasks.save(t);
    return this.detail(id);
  }

  // ---------------------------------------------------------------- 结案
  async close(id: number, dto: { conclusion: string; responsibleParty?: string; resumeSupplier?: boolean }, user: AuthUser) {
    const ev = await this.requireEvent(id);
    if (!dto.conclusion) throw new BadRequestException('请填写结案结论');
    const openTasks = await this.tasks.count({ where: { traceEventId: id, status: In(['open', 'done']) } });
    ev.conclusion = dto.conclusion;
    ev.responsibleParty = dto.responsibleParty || ev.responsibleParty;
    ev.status = 'closed';
    ev.closedAt = new Date();
    await this.events.save(ev);
    if (dto.resumeSupplier && ev.supplierId) {
      await this.resumeSupplier(id, { note: '事件结案，整改验收通过，恢复供料' }, user);
    }
    await this.log(id, 'close', `事件结案：${dto.conclusion}${openTasks ? `（尚有 ${openTasks} 项整改任务未验收，请继续闭环）` : ''}`, user);
    return this.detail(id);
  }

  async reopen(id: number, user: AuthUser) {
    const ev = await this.requireEvent(id);
    ev.status = 'rectifying';
    ev.closedAt = null;
    await this.events.save(ev);
    await this.log(id, 'comment', '事件重新打开，继续处置', user);
    return this.detail(id);
  }

  // ---------------------------------------------------------------- 看板与下拉数据
  async dashboard() {
    const events = await this.events.find({ relations: ['supplier'] });
    const reports = await this.reports.find();
    const contacts = await this.contacts.find();
    const submissions = await this.submissions.find();
    const tasks = await this.tasks.find();
    const sickWorkers = new Set(reports.filter((r) => ['inpatient', 'outpatient', 'observation'].includes(r.medicalStatus)).map((r) => r.workerName)).size;
    return {
      eventTotal: events.length,
      investigating: events.filter((e) => e.status === 'investigating').length,
      testing: events.filter((e) => e.status === 'testing').length,
      rectifying: events.filter((e) => e.status === 'rectifying').length,
      closed: events.filter((e) => e.status === 'closed').length,
      reportCount: reports.length,
      sickWorkerCount: sickWorkers,
      contactCount: contacts.length,
      observing: contacts.filter((c) => c.observeStatus === 'observing' || c.observeStatus === 'confirmed_sick').length,
      submissionPending: submissions.filter((s) => ['pending', 'testing'].includes(s.result)).length,
      submissionFailed: submissions.filter((s) => s.result === 'failed').length,
      taskOpen: tasks.filter((t) => t.status !== 'verified').length,
      suspendedSuppliers: events
        .map((e) => e.supplier)
        .filter((s, i, arr) => s && s.status === 'suspended' && arr.findIndex((x) => x?.id === s.id) === i),
    };
  }

  options() {
    return {
      symptoms: Object.entries(SYMPTOM_LABELS).map(([value, label]) => ({ value, label })),
      medical: Object.entries(MEDICAL_LABELS).map(([value, label]) => ({ value, label })),
      testItems: ['菌落总数', '大肠菌群', '沙门氏菌', '金黄色葡萄球菌', '副溶血性弧菌', '农药残留'].map((v) => v),
    };
  }

  // ---------------------------------------------------------------- helpers
  private async requireEvent(id: number): Promise<TraceEvent> {
    const ev = await this.events.findOne({ where: { id } });
    if (!ev) throw new NotFoundException('追溯事件不存在');
    return ev;
  }

  private async log(eventId: number, action: string, content: string, user: AuthUser) {
    await this.actions.save(this.actions.create({
      traceEventId: eventId, actorId: user.sub, actorRole: user.role, action, content,
    }));
  }

  private normList(v: any): string[] {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    return [];
  }

  private fmt(d: Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private observeLabel(s: string) {
    return ({ none: '无需观察', observing: '停餐观察中', resumed: '已恢复供餐', confirmed_sick: '确认发病就医' } as any)[s] || s;
  }

  private roleName(r: string) {
    return ({ CANTEEN: '食堂', PROJECT: '项目部', SAFETY: '安全员', FOREMAN: '班组长', FINANCE: '财务' } as any)[r] || r;
  }
}
