import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Team } from '../entities/team.entity';
import { Worker } from '../entities/worker.entity';
import { Attendance } from '../entities/attendance.entity';
import { ConstructionPlan } from '../entities/construction-plan.entity';
import { Canteen } from '../entities/canteen.entity';
import { Supplier } from '../entities/supplier.entity';
import { MealSession } from '../entities/meal-session.entity';
import { MealOrder } from '../entities/meal-order.entity';
import { MealPreparation } from '../entities/meal-preparation.entity';
import { FoodSample } from '../entities/food-sample.entity';
import { MealDelivery } from '../entities/meal-delivery.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { ExtraMeal } from '../entities/extra-meal.entity';
import { ExtraMealPoint } from '../entities/extra-meal-point.entity';
import { ExtraMealPickup } from '../entities/extra-meal-pickup.entity';
import { Incident } from '../entities/incident.entity';
import { ContactPerson } from '../entities/contact-person.entity';
import { RectificationTask } from '../entities/rectification-task.entity';
import { SupplierFoodEvent } from '../entities/supplier-food-event.entity';
import { allocate, synthesizeOne } from '../modules/allocation';
import { TraceService } from '../modules/trace.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('Seed');
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Team) private teams: Repository<Team>,
    @InjectRepository(Worker) private workers: Repository<Worker>,
    @InjectRepository(Attendance) private attendance: Repository<Attendance>,
    @InjectRepository(ConstructionPlan) private plans: Repository<ConstructionPlan>,
    @InjectRepository(Canteen) private canteens: Repository<Canteen>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(MealSession) private sessions: Repository<MealSession>,
    @InjectRepository(MealOrder) private orders: Repository<MealOrder>,
    @InjectRepository(MealPreparation) private preps: Repository<MealPreparation>,
    @InjectRepository(FoodSample) private samples: Repository<FoodSample>,
    @InjectRepository(MealDelivery) private deliveries: Repository<MealDelivery>,
    @InjectRepository(MealPickup) private pickups: Repository<MealPickup>,
    @InjectRepository(ExtraMeal) private extras: Repository<ExtraMeal>,
    @InjectRepository(ExtraMealPoint) private extraPoints: Repository<ExtraMealPoint>,
    @InjectRepository(ExtraMealPickup) private extraPickups: Repository<ExtraMealPickup>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    @InjectRepository(ContactPerson) private traceContacts: Repository<ContactPerson>,
    @InjectRepository(RectificationTask) private rectTasks: Repository<RectificationTask>,
    @InjectRepository(SupplierFoodEvent) private supplierFoodEvents: Repository<SupplierFoodEvent>,
    private trace: TraceService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.users.count();
      if (count > 0) { this.logger.log('种子数据已存在，跳过'); return; }
      await this.run();
      this.logger.log('✅ 演示数据初始化完成');
    } catch (e) {
      this.logger.error('种子初始化失败: ' + (e as Error).message);
    }
  }

  private async run() {
    const today = new Date().toISOString().slice(0, 10);
    const pwd = await bcrypt.hash('123456', 10);
    const mkUser = async (username: string, name: string, role: string, phone: string) =>
      this.users.save(this.users.create({ username, password: pwd, name, role, phone }));

    // ---- 账号（逐角色） ----
    const admin = await mkUser('admin', '平台管理员', 'ADMIN', '13800000000');
    const foreman1 = await mkUser('banzu1', '王强（钢筋一班班长）', 'FOREMAN', '13800000001');
    const foreman2 = await mkUser('banzu2', '李刚（混凝土二班班长）', 'FOREMAN', '13800000002');
    const canteenUser = await mkUser('shitang', '周师傅（食堂厨师长）', 'CANTEEN', '13800000003');
    const projectUser = await mkUser('xiangmu', '赵项目部', 'PROJECT', '13800000004');
    const financeUser = await mkUser('caiwu', '钱财务', 'FINANCE', '13800000005');
    const safetyUser = await mkUser('anquan', '孙安全员', 'SAFETY', '13800000006');
    await mkUser('gongren', '农民工代表(陈大柱)', 'WORKER', '13800000007');

    // ---- 食堂（外包）与供应商 ----
    const canteen = await this.canteens.save(this.canteens.create({
      name: '工地第一食堂（外包-鸿福餐饮）', capacity: 260, outsourced: true,
      manager: '周师傅', phone: '13800000003', vendorScore: 88,
      nightDuty: true, nightDutyChef: '夜班李厨', nightDutyPhone: '13700000099',
      ingredientStock: 60,
    }));
    const sup1 = await this.suppliers.save(this.suppliers.create({
      name: '绿源农副产品配送', contact: '刘老板', phone: '13911110001', licenseNo: 'SC2025001', canteenId: canteen.id,
    }));
    const sup2 = await this.suppliers.save(this.suppliers.create({
      name: '正大红肉联', contact: '马老板', phone: '13911110002', licenseNo: 'SC2025002', deduction: 300, canteenId: canteen.id,
    }));

    // ---- 班组与工人 ----
    const teamDefs = [
      { name: '钢筋一班', trade: '钢筋工', dorm: 40, leader: foreman1.id, surnames: ['陈大柱', '刘二牛', '张铁柱', '马建国', '杨守义', '黄志强', '吴大勇', '周福来', '徐根生', '朱海峰'] },
      { name: '混凝土二班', trade: '混凝土工', dorm: 36, leader: foreman2.id, surnames: ['胡满仓', '林广田', '何开山', '高进', '罗世军', '梁宝山', '宋德柱', '谢长河', '韩春雷'] },
      { name: '架子工班', trade: '架子工', dorm: 24, leader: foreman1.id, surnames: ['唐立军', '冯远征', '董振华', '萧远山', '程卫东', '曹国庆', '袁立根', '邓石生'] },
    ];

    const allWorkers: Worker[] = [];
    let code = 1001;
    for (const td of teamDefs) {
      const team = await this.teams.save(this.teams.create({
        name: td.name, trade: td.trade, dormHeadcount: td.dorm, leaderUserId: td.leader,
      }));
      td.surnames.forEach((nm, i) => {
        // 每班组最后 1 名工人未实名（新工人）
        const verified = i < td.surnames.length - 1;
        allWorkers.push(this.workers.create({
          name: nm, teamId: team.id,
          idCard: verified ? '3201' + String(19800101 + team.id * 100 + i) : null,
          faceToken: verified ? `FACE-${team.id}-${i + 1}` : null,
          pickupCode: 'P' + (code++),
          verified,
          ethnicity: nm === '马建国' ? '回族' : '汉',
          trade: td.trade,
        }));
      });
    }
    const savedWorkers = await this.workers.save(allWorkers);

    // ---- 实名考勤：今天白班大部分在岗；部分夜班；1 人缺勤 ----
    const att: Attendance[] = [];
    savedWorkers.forEach((w, i) => {
      att.push(this.attendance.create({
        workerId: w.id, date: today, shift: 'day', present: i !== 5,
        location: i % 4 === 0 ? '3号楼主体' : i % 4 === 1 ? '地下车库' : '塔吊作业区',
      }));
      // 每班组前 3 人排夜班（夜宵）
      if (i % 10 < 3) {
        att.push(this.attendance.create({ workerId: w.id, date: today, shift: 'night', present: true, location: '夜间浇筑区' }));
      }
    });
    await this.attendance.save(att);

    // ---- 餐次：今天 午餐 / 晚餐 / 夜宵 ----
    const mkSession = async (shift: string, price: number, ws: number, cs: number, weather: string, status: string) =>
      this.sessions.save(this.sessions.create({
        date: today, shift, canteenId: canteen.id, price, workerSubsidy: ws, companySubsidy: cs,
        weather, status,
      }));
    const lunch = await mkSession('lunch', 15, 8, 5, '高温', 'serving');
    const dinner = await mkSession('dinner', 15, 8, 5, '高温', 'confirmed');
    const midnight = await mkSession('midnight', 12, 6, 4, '夜间', 'confirmed');

    // ---- 班组长订餐申报 ----
    const teamRows = await this.teams.find();
    const orderDefs: Array<[MealSession, number, number, number, number, number, string, number]> = [
      // session, teamIdx, 人数, 夜宵, 少数民族, 加班, 区域, 班长
      [lunch, 0, 10, 0, 1, 1, '3号楼主体', foreman1.id],
      [lunch, 1, 9, 0, 0, 2, '地下车库', foreman2.id],
      [lunch, 2, 8, 0, 0, 0, '塔吊作业区', foreman1.id],
      [dinner, 0, 8, 3, 1, 2, '3号楼主体', foreman1.id],
      [dinner, 1, 7, 2, 0, 3, '地下车库', foreman2.id],
      [midnight, 0, 0, 3, 1, 1, '夜间浇筑区', foreman1.id],
      [midnight, 1, 0, 3, 0, 2, '塔吊作业区', foreman2.id],
    ];
    for (const [s, ti, hc, night, ethnic, ot, zone, fid] of orderDefs) {
      await this.orders.save(this.orders.create({
        sessionId: s.id, teamId: teamRows[ti].id, foremanId: fid,
        headcount: hc, trades: teamRows[ti].trade, nightSnackCount: night, ethnicCount: ethnic,
        overtimeCount: ot, deliveryZone: zone, status: 'draft',
      }));
    }

    // ---- 施工计划：项目部排班（白班/夜班各班组计划上岗人数 + 作业区） ----
    const planDefs: Array<[string, number, number, string, boolean]> = [
      // shift, teamIdx, plannedWorkers, area, nightWork
      ['day', 0, 10, '3号楼主体', false],
      ['day', 1, 9, '地下车库', false],
      ['day', 2, 8, '塔吊作业区', false],
      ['night', 0, 3, '夜间浇筑区', true],
      ['night', 1, 3, '塔吊作业区', true],
      ['night', 2, 2, '2#塔吊安全平台', true],
    ];
    for (const [shift, ti, plannedWorkers, area, nightWork] of planDefs) {
      await this.plans.save(this.plans.create({
        date: today, shift: shift as string, teamId: teamRows[ti].id,
        plannedWorkers, workArea: area, nightWork,
      }));
    }

    // 模拟生成：四来源（考勤/宿舍/计划/申报）合成 + 最大余数法产能分配（食堂产能 260，充足）
    const genFor = async (s: MealSession) => {
      const os = await this.orders.find({ where: { sessionId: s.id }, relations: ['team'] });
      const shift = s.shift === 'midnight' ? 'night' : 'day';
      const atts = await this.attendance.find({ where: { date: today, shift, present: true }, relations: ['worker'] });
      const presentByTeam: Record<number, number> = {};
      atts.forEach((a) => { presentByTeam[a.worker.teamId] = (presentByTeam[a.worker.teamId] || 0) + 1; });
      const planRecs = await this.plans.find({ where: { date: today, shift } });
      const planByTeam: Record<number, number> = {};
      planRecs.forEach((p) => { planByTeam[p.teamId] = p.plannedWorkers; });

      const demandRows = os.map((o) => synthesizeOne({
        teamId: o.teamId,
        present: presentByTeam[o.teamId] ?? 0,
        dorm: o.team?.dormHeadcount ?? 0,
        plan: planByTeam[o.teamId] ?? 0,
        declared: o.headcount || 0,
        overtime: o.overtimeCount || 0,
        nightSnack: o.nightSnackCount || 0,
        ethnic: o.ethnicCount || 0,
        isMidnight: s.shift === 'midnight',
      }));
      const result = allocate(demandRows, canteen.capacity);
      for (let idx = 0; idx < os.length; idx++) {
        const o = os[idx]; const r = result.rows[idx];
        o.generatedCount = r.allocated;
        o.status = result.capacityAdjusted ? 'adjusted' : 'generated';
        o.demandDetail = JSON.stringify({
          present: r.present, dorm: r.dorm, plan: r.plan, declared: r.declared,
          baseWorkers: r.baseWorkers, want: r.want, allocated: r.allocated,
        });
        await this.orders.save(o);
      }
    };
    await genFor(lunch); await genFor(dinner); await genFor(midnight);

    // ---- 午餐备餐：菜单 / 食材批次 / 供应商 / 厨师 / 温控 / 分餐时间 ----
    const prep = await this.preps.save(this.preps.create({
      sessionId: lunch.id,
      menu: '红烧鸡腿、青椒土豆丝、蒜蓉青菜、番茄蛋汤、米饭（另备清真餐：红烧牛肉）',
      ingredientBatch: 'BATCH-20260914-A', supplierId: sup1.id, chef: '周师傅',
      coreTemp: 75.5, ambientTemp: 31.2, cookTime: '10:30', serveTime: '11:30',
      preparedCount: 28, shortageCount: 2, lossCount: 1,
      note: '高温天加大绿豆汤供应；清真餐单独留样',
    }));
    // 留样：每菜 125g、48h、4℃
    for (const dish of ['红烧鸡腿', '青椒土豆丝', '蒜蓉青菜', '番茄蛋汤', '清真红烧牛肉']) {
      const now = new Date();
      await this.samples.save(this.samples.create({
        preparationId: prep.id, dishName: dish, weightGram: 125,
        boxNo: 'BOX-' + dish.slice(0, 2), fridgeTemp: 3.8, sampledBy: '周师傅',
        sampleAt: now, expireAt: new Date(now.getTime() + 48 * 3600e3), status: 'retained',
      }));
    }
    // 昨日一条留样检测合格、一条异常（关联到 prep 仅演示检测结论）
    const old = await this.preps.save(this.preps.create({
      sessionId: lunch.id, menu: '（昨日）凉拌黄瓜、回锅肉', ingredientBatch: 'BATCH-20260913',
      supplierId: sup2.id, chef: '李厨', coreTemp: 72, ambientTemp: 29, cookTime: '昨日10:30',
      serveTime: '昨日11:30', preparedCount: 0,
    }));
    const oldNow = new Date(Date.now() - 26 * 3600e3);
    await this.samples.save(this.samples.create({
      preparationId: old.id, dishName: '凉拌黄瓜', weightGram: 125, fridgeTemp: 4.2, sampledBy: '李厨',
      sampleAt: oldNow, expireAt: new Date(oldNow.getTime() + 48 * 3600e3),
      status: 'failed', labResult: '菌落总数超标，已封存同批次并对正大红肉联扣款300元',
    }));
    await this.samples.save(this.samples.create({
      preparationId: old.id, dishName: '回锅肉', weightGram: 125, fridgeTemp: 3.9, sampledBy: '李厨',
      sampleAt: oldNow, expireAt: new Date(oldNow.getTime() + 48 * 3600e3),
      status: 'passed', labResult: '检测合格',
    }));
    // 供应商历史食安档案：昨日留样不合格已扣款（与异常协同旧单对应）
    await this.supplierFoodEvents.save(this.supplierFoodEvents.create({
      supplierId: sup2.id, type: 'lab_fail', title: '凉拌黄瓜 留样检测不合格（历史）',
      content: '菌落总数超标，封存同批次食材', traceCode: '历史工单', sampleBoxNo: 'BOX-凉拌',
      dishName: '凉拌黄瓜',
    }));
    await this.supplierFoodEvents.save(this.supplierFoodEvents.create({
      supplierId: sup2.id, type: 'penalty', title: '追责扣款 ¥300（历史）',
      content: '留样检测不合格按协议扣款', traceCode: '历史工单', amount: 300,
    }));

    // ---- 晚餐备餐：与午餐同批食材 BATCH-20260914-A（同批食材跨餐次复用，供追溯扫描） ----
    const dinnerPrep = await this.preps.save(this.preps.create({
      sessionId: dinner.id,
      menu: '土豆烧鸡块（同批鸡腿肉）、清炒时蔬、紫菜蛋汤、米饭',
      ingredientBatch: 'BATCH-20260914-A', supplierId: sup1.id, chef: '周师傅',
      coreTemp: 74.0, ambientTemp: 30.5, cookTime: '16:30', serveTime: '17:30',
      preparedCount: 24, shortageCount: 0, lossCount: 0,
      note: '沿用午餐同批配送食材',
    }));

    // ---- 夜宵配送：塔吊作业区 / 夜间分散点，保温 + 安全确认 ----
    await this.deliveries.save(this.deliveries.create({
      sessionId: midnight.id, zone: '塔吊作业区', route: '食堂→东侧施工通道→2#塔吊底部安全平台',
      count: 5, keepWarmTemp: 62, carrier: '郑配送', safetyCheck: '高空坠物警戒已设、佩戴安全帽、封闭区登记',
      departAt: new Date(Date.now() - 3600e3), arriveAt: new Date(Date.now() - 3300e3), status: 'delivered',
    }));
    await this.deliveries.save(this.deliveries.create({
      sessionId: midnight.id, zone: '夜间浇筑区', route: '食堂→南门→地下车库入口', count: 4, keepWarmTemp: 60,
      carrier: '郑配送', safetyCheck: '夜间照明正常、雨天防滑垫已铺', status: 'in_transit',
    }));

    // ---- 取餐流水：三餐均生成；刷脸/扫码；含跨班组、未实名；核算补贴/自费；回填班组取餐数 ----
    const seedPickups = async (s: MealSession, rate: number, withCross: boolean) => {
      const fee = s.shift === 'midnight' ? { price: 12, w: 6, c: 4 } : { price: 15, w: 8, c: 5 };
      const os = await this.orders.find({ where: { sessionId: s.id } });
      let count = 0;
      for (const o of os) {
        const members = savedWorkers.filter((x) => x.teamId === o.teamId);
        const n = Math.min(members.length, Math.max(1, Math.round(o.generatedCount * rate)));
        for (let i = 0; i < n; i++) {
          const wk = members[i];
          let serveTeamId = wk.teamId;
          let cross = false;
          // 制造一条跨班组取餐：混凝土二班的人到架子工班餐点取
          if (withCross && o.teamId === teamRows[1].id && i === 0) { cross = true; serveTeamId = teamRows[2].id; }
          const wsub = wk.verified ? fee.w : 0;
          const csub = wk.verified ? fee.c : 0;
          await this.pickups.save(this.pickups.create({
            sessionId: s.id, workerId: wk.id, teamId: serveTeamId,
            method: i % 3 === 0 ? 'code' : 'face', crossTeam: cross, unverified: !wk.verified,
            price: fee.price, workerSubsidy: wsub, companySubsidy: csub, selfPay: fee.price - wsub - csub,
            operator: i % 3 === 0 ? '闸机扫码' : '人脸识别一体机',
          }));
          count++;
        }
        o.pickedCount = n;
        await this.orders.save(o);
      }
      return count;
    };
    const lunchPicks = await seedPickups(lunch, 0.8, true);
    const dinnerPicks = await seedPickups(dinner, 0.85, false);
    const nightPicks = await seedPickups(midnight, 0.9, false);
    const totalPicks = lunchPicks + dinnerPicks + nightPicks;

    // ---- 夜间加班临时加餐：混凝土浇筑到深夜（归入夜宵餐次） ----
    const photoSVG = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#274"/> <text x="80" y="50" font-size="13" fill="#fff" text-anchor="middle">送达照片</text></svg>',
    );
    const extra = await this.extras.save(this.extras.create({
      sessionId: midnight.id, canteenId: canteen.id, requesterId: foreman2.id,
      date: today, reason: '项目部临时安排 2#楼混凝土浇筑到深夜，作业人员需加餐',
      requestedCount: 7, confirmedCount: 7, menu: '夜班加餐：热粥、肉包、卤蛋',
      price: 12, workerSubsidy: 0, companySubsidy: 12, selfPay: 0,
      status: 'received', highRisk: true,
      safetyNote: '已确认东侧专用通道送餐，塔吊点停留≤10分钟，全程佩戴安全帽并设警戒',
      safetyUserId: safetyUser.id, safetyConfirmedAt: new Date(Date.now() - 90 * 60e3),
      canteenUserId: canteenUser.id, canteenConfirmedAt: new Date(Date.now() - 70 * 60e3),
    }));
    // 配送点1：塔吊底部安全平台（高风险），足额签收
    const pA = await this.extraPoints.save(this.extraPoints.create({
      extraMealId: extra.id, teamId: teamRows[1].id, pointName: '2#塔吊底部安全平台',
      route: '食堂→东侧施工通道→2#塔吊底部安全平台', stayMinutes: 8,
      sentCount: 3, receivedCount: 3, remainingCount: 0, receiver: '胡满仓', receiverPhone: '13700001111',
      temp: 62, arrivedAt: new Date(Date.now() - 55 * 60e3),
      photo: `data:image/svg+xml,${photoSVG}`, status: 'received',
    }));
    // 配送点2：夜间浇筑区，送达4份签收3份，剩余1份（漏领预警）
    const pB = await this.extraPoints.save(this.extraPoints.create({
      extraMealId: extra.id, teamId: teamRows[0].id, pointName: '夜间浇筑区',
      route: '食堂→南门→地下车库入口→夜间浇筑区', stayMinutes: 15,
      sentCount: 4, receivedCount: 3, remainingCount: 1, receiver: '陈大柱', receiverPhone: '13700001122',
      temp: 60, arrivedAt: new Date(Date.now() - 50 * 60e3),
      photo: `data:image/svg+xml,${photoSVG}`, status: 'received',
    }));
    // 领取人员（6 人，企业全额承担），演示用，不重复写入夜宵餐次取餐表以免取餐率超 100%
    const nightWorkers = savedWorkers.filter((w) => [teamRows[1].id, teamRows[0].id].includes(w.teamId)).slice(0, 6);
    for (let k = 0; k < nightWorkers.length; k++) {
      await this.extraPickups.save(this.extraPickups.create({
        extraMealId: extra.id, pointId: k < 3 ? pA.id : pB.id,
        workerId: nightWorkers[k].id, teamId: nightWorkers[k].teamId, method: k % 2 ? 'face' : 'code',
        price: 12, workerSubsidy: 0, companySubsidy: 12, selfPay: 0, operator: '夜间加餐',
      }));
    }

    // ---- 异常协同（多方同一餐次） ----
    await this.incidents.save(this.incidents.create({
      sessionId: lunch.id, type: 'SPOILED', title: '工人投诉凉拌黄瓜有异味',
      description: '钢筋一班 3 名工人反映昨日凉菜疑似变质，出现腹泻，要求食堂排查并留样送检。',
      severity: 'high', reporterId: foreman1.id,
      involvedRoles: 'FOREMAN,CANTEEN,SAFETY,FINANCE,PROJECT',
      responsibleParty: '正大红肉联/食堂', adjustmentAmount: 300, status: 'resolved',
      resolution: '留样检测菌落总数超标，已销毁同批次食材，供应商扣款300元，食堂外包考核扣5分，工人免单并安排医务观察。',
    }));
    await this.incidents.save(this.incidents.create({
      sessionId: midnight.id, type: 'NIGHT_ZONE', title: '夜宵需送至塔吊作业区',
      description: '塔吊司机夜间无法离岗，要求 22:30 前将夜宵送至 2# 塔吊底部安全平台。',
      severity: 'medium', reporterId: foreman2.id, involvedRoles: 'FOREMAN,CANTEEN,SAFETY',
      status: 'resolved', resolution: '已规划东侧专用路线，保温箱 62℃，安全员现场确认警戒后交付。',
    }));
    await this.incidents.save(this.incidents.create({
      sessionId: lunch.id, type: 'SUBSIDY_DISPUTE', title: '自费金额争议（未实名新工人）',
      description: '新工人未完成刷脸实名，取餐被收全额 15 元，认为应享 13 元补贴，只付 2 元。',
      severity: 'medium', reporterId: financeUser.id, involvedRoles: 'FOREMAN,FINANCE,PROJECT',
      status: 'open',
    }));
    await this.incidents.save(this.incidents.create({
      sessionId: dinner.id, type: 'SHORTAGE', title: '食堂菜品不够，缺口 2 份',
      description: '高温天临时加班人数增加，晚餐红烧鸡腿备餐不足，缺口约 2 份。',
      severity: 'low', reporterId: canteenUser.id, involvedRoles: 'CANTEEN,FOREMAN,PROJECT',
      status: 'open',
    }));
    await this.incidents.save(this.incidents.create({
      sessionId: lunch.id, type: 'WEATHER', title: '高温天送餐路线与留样管理',
      description: '当日最高温 36℃，要求送餐缩短至 20 分钟内、增加保温/冷藏措施，留样冰箱温度加密巡检。',
      severity: 'medium', reporterId: safetyUser.id, involvedRoles: 'CANTEEN,SAFETY,FOREMAN',
      status: 'resolved', resolution: '启用保温箱+冰袋双控，配送路线避开暴晒区，留样温度每 2 小时记录一次。',
    }));

    // ---- 食品不适追溯（多名工人腹痛/呕吐，完整处置链演示） ----
    const actorProject = { sub: projectUser.id, role: 'PROJECT', name: '赵项目部' };
    const actorForeman = { sub: foreman1.id, role: 'FOREMAN', name: '王强' };
    const actorSafety = { sub: safetyUser.id, role: 'SAFETY', name: '孙安全员' };

    // 今日午餐后多名工人腹痛呕吐 → 项目部建档追溯（关联午餐餐次，自动带出供应商与食材批次）
    const lunchTime = new Date(`${today}T11:40:00`);
    const traceEv = await this.trace.create({
      title: '午餐后多名工人腹痛呕吐，启动食品不适追溯',
      description: '午饭后约 1 小时，钢筋一班、混凝土二班共 4 名工人先后出现腹痛、呕吐、腹泻，其中 1 人送镇卫生院观察。项目部立即启动追溯：暂停涉事供应商、同餐次人员回访停餐观察、留样送检、同批食材去向排查并生成整改任务。',
      severity: 'high',
      sessionId: lunch.id,
      mealTime: lunchTime.toISOString(),
      dishes: '红烧鸡腿,番茄蛋汤',
      sampleBoxNos: 'BOX-红烧,BOX-番茄',
    }, actorSafety);

    // 逐人收集：取餐时间 / 菜品 / 班组 / 留样编号 / 就医记录
    const sickWorkers = [
      { w: savedWorkers[0], symptoms: ['abdominal_pain', 'vomiting'], med: 'outpatient', hospital: '镇卫生院', diagnosis: '急性胃肠炎（疑似食物中毒）', dishes: '红烧鸡腿、番茄蛋汤、米饭', box: 'BOX-红烧' },
      { w: savedWorkers[1], symptoms: ['abdominal_pain', 'vomiting', 'fever'], med: 'observation', hospital: '工地医务室', diagnosis: '腹痛呕吐，留观补液', dishes: '红烧鸡腿、青椒土豆丝、米饭', box: 'BOX-红烧' },
      { w: savedWorkers[2], symptoms: ['abdominal_pain', 'nausea'], med: 'none', hospital: '', diagnosis: '', dishes: '红烧鸡腿、米饭', box: 'BOX-红烧' },
      { w: savedWorkers[10], symptoms: ['abdominal_pain', 'diarrhea'], med: 'inpatient', hospital: '区人民医院', diagnosis: '感染性腹泻，住院治疗', dishes: '红烧鸡腿、番茄蛋汤、米饭', box: 'BOX-红烧' },
    ];
    for (const s of sickWorkers) {
      await this.trace.addReport(traceEv.id, {
        workerId: s.w.id,
        symptoms: s.symptoms,
        onsetAt: new Date(lunchTime.getTime() + 70 * 60e3).toISOString(),
        pickupAt: lunchTime.toISOString(),
        dishes: s.dishes,
        sampleBoxNo: s.box,
        medicalStatus: s.med,
        hospital: s.hospital,
        diagnosis: s.diagnosis,
        medicalNote: s.med === 'inpatient' ? '体温38.1℃，已补液并通知家属，医保/工伤对接中' : '',
      }, actorForeman);
    }

    // 从取餐流水生成同餐次人员名单 → 通知 + 48 小时停餐观察
    await this.trace.buildContacts(traceEv.id, actorProject);
    await this.trace.notifyContacts(traceEv.id, {
      channel: '电话+班组长转达', suspendMeal: true, observeHours: 48,
      content: '请留意腹痛呕吐症状，48小时内暂停食堂供餐并观察',
    }, actorProject);
    // 回访：症状较轻者恢复供餐
    const zhangContact = await this.traceContacts.findOne({
      where: { traceEventId: traceEv.id, workerId: savedWorkers[2].id },
    });
    if (zhangContact) {
      await this.trace.followUp(traceEv.id, zhangContact.id, {
        observeStatus: 'resumed', resume: true, followUpResult: '次日回访症状消失，已恢复正常上班与供餐',
      }, actorForeman);
    }

    // 项目部暂停涉事食材供应商
    await this.trace.suspendSupplier(traceEv.id, {
      supplierId: sup1.id,
      reason: '午餐后多名工人腹痛呕吐疑似食材污染，调查送检期间暂停供料',
    }, actorProject);

    // 留样送检：红烧鸡腿 + 番茄蛋汤
    const lunchSamples = await this.samples.find({ where: { preparationId: prep.id } });
    const meatSample = lunchSamples.find((s) => s.dishName === '红烧鸡腿');
    const soupSample = lunchSamples.find((s) => s.dishName === '番茄蛋汤');
    await this.trace.submitSample(traceEv.id, {
      sampleId: meatSample.id, labName: '市食品检验检测中心', labContact: '0571-88001234',
      testItems: ['菌落总数', '大肠菌群', '沙门氏菌', '金黄色葡萄球菌'],
    }, actorProject);
    await this.trace.submitSample(traceEv.id, {
      sampleId: soupSample.id, labName: '市食品检验检测中心', labContact: '0571-88001234',
      testItems: ['菌落总数', '大肠菌群'],
    }, actorSafety);
    const subs = (await this.trace.detail(traceEv.id)).submissions;
    const meatSub = subs.find((s) => s.dishName === '红烧鸡腿');
    const soupSub = subs.find((s) => s.dishName === '番茄蛋汤');
    // 检测结果：鸡腿不合格（同步供应商档案+追责扣款2000），蛋汤合格
    await this.trace.recordLabResult(traceEv.id, meatSub.id, {
      result: 'failed', penaltyAmount: 2000,
      labReport: '菌落总数 8.2×10⁵ CFU/g（限值≤10⁵），检出沙门氏菌，判定不合格',
    }, actorProject);
    await this.trace.recordLabResult(traceEv.id, soupSub.id, {
      result: 'passed', labReport: '菌落总数、大肠菌群均符合 GB 31659 限量要求',
    }, actorSafety);

    // 同批食材去向：扫描 BATCH-20260914-A 是否用于其他餐次（晚餐同批，纳入追责范围）
    await this.trace.scanBatch(traceEv.id, { ingredientBatch: 'BATCH-20260914-A' }, actorSafety);
    const usages = (await this.trace.detail(traceEv.id)).batchUsages;
    const dinnerUsage = usages.find((u) => u.sessionId === dinner.id);
    if (dinnerUsage) {
      await this.trace.setBatchUsage(traceEv.id, dinnerUsage.id, {
        status: 'sealed', riskNote: '晚餐已使用同批鸡腿肉，剩余库存已封存；本餐次取餐人员纳入重点回访，暂未出现新发症状',
      }, actorSafety);
    }

    // 生成安全整改任务包并完成/验收部分任务（保留进行中状态便于演示）
    await this.trace.generateTaskPackage(traceEv.id, actorProject);
    const taskRows = await this.rectTasks.find({ where: { traceEventId: traceEv.id } });
    const sealTask = taskRows.find((t) => t.category === 'seal');
    const disinfectTask = taskRows.find((t) => t.category === 'disinfect');
    if (sealTask) {
      await this.trace.updateTask(traceEv.id, sealTask.id, { status: 'done', result: '同批鸡腿肉及半成品共 32kg 已上锁封存，拍照留档' }, { sub: canteenUser.id, role: 'CANTEEN', name: '周师傅' });
      await this.trace.updateTask(traceEv.id, sealTask.id, { status: 'verified' }, actorSafety);
    }
    if (disinfectTask) {
      await this.trace.updateTask(traceEv.id, disinfectTask.id, { status: 'done', result: '操作间、刀具砧板、留样冰箱已完成含氯消毒并记录' }, { sub: canteenUser.id, role: 'CANTEEN', name: '周师傅' });
    }

    // ---- 历史已结案追溯事件（昨日凉菜，已康复结案；供应商档案留痕） ----
    const yesterday = new Date(Date.now() - 26 * 3600e3);
    const oldTrace = await this.trace.create({
      title: '昨日凉拌黄瓜腹泻追溯（已结案）',
      description: '2 名工人食用昨日午餐凉拌黄瓜后腹泻，留样送检菌落总数超标，供应商已扣款并整改。',
      severity: 'medium',
      supplierId: sup2.id,
      mealTime: yesterday.toISOString(),
      dishes: '凉拌黄瓜',
      sampleBoxNos: 'BOX-凉拌',
    }, actorSafety);
    await this.trace.addReport(oldTrace.id, {
      workerId: savedWorkers[7].id, symptoms: ['diarrhea', 'abdominal_pain'],
      pickupAt: yesterday.toISOString(), dishes: '凉拌黄瓜、回锅肉', sampleBoxNo: 'BOX-凉拌',
      medicalStatus: 'outpatient', hospital: '镇卫生院', diagnosis: '急性肠炎',
      status: 'recovered',
    }, actorForeman);
    await this.trace.close(oldTrace.id, {
      conclusion: '留样检测菌落总数超标，销毁同批次食材，供应商正大红肉联扣款 300 元并整改；2 名工人均已康复，事件结案。',
      responsibleParty: '正大红肉联',
    }, actorProject);

    this.logger.log(`种子完成：${today} 餐次3个、订餐7条、取餐${totalPicks}条、留样7份、异常5条、食品不适追溯2起（在查1起/已结案1起）`);
  }
}
