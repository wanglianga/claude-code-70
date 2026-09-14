import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Team } from '../entities/team.entity';
import { Worker } from '../entities/worker.entity';
import { Attendance } from '../entities/attendance.entity';
import { Canteen } from '../entities/canteen.entity';
import { Supplier } from '../entities/supplier.entity';
import { MealSession } from '../entities/meal-session.entity';
import { MealOrder } from '../entities/meal-order.entity';
import { MealPreparation } from '../entities/meal-preparation.entity';
import { FoodSample } from '../entities/food-sample.entity';
import { MealDelivery } from '../entities/meal-delivery.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { Incident } from '../entities/incident.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('Seed');
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Team) private teams: Repository<Team>,
    @InjectRepository(Worker) private workers: Repository<Worker>,
    @InjectRepository(Attendance) private attendance: Repository<Attendance>,
    @InjectRepository(Canteen) private canteens: Repository<Canteen>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(MealSession) private sessions: Repository<MealSession>,
    @InjectRepository(MealOrder) private orders: Repository<MealOrder>,
    @InjectRepository(MealPreparation) private preps: Repository<MealPreparation>,
    @InjectRepository(FoodSample) private samples: Repository<FoodSample>,
    @InjectRepository(MealDelivery) private deliveries: Repository<MealDelivery>,
    @InjectRepository(MealPickup) private pickups: Repository<MealPickup>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
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
    }));
    const sup1 = await this.suppliers.save(this.suppliers.create({
      name: '绿源蔬菜配送', contact: '刘老板', phone: '13911110001', licenseNo: 'SC2025001', canteenId: canteen.id,
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

    // 模拟生成（按考勤 + 产能 260 足够）
    const genFor = async (s: MealSession) => {
      const os = await this.orders.find({ where: { sessionId: s.id } });
      const shift = s.shift === 'midnight' ? 'night' : 'day';
      const atts = await this.attendance.find({ where: { date: today, shift, present: true }, relations: ['worker'] });
      const presentByTeam: Record<number, number> = {};
      atts.forEach((a) => { presentByTeam[a.worker.teamId] = (presentByTeam[a.worker.teamId] || 0) + 1; });
      for (const o of os) {
        const base = presentByTeam[o.teamId] ?? o.headcount;
        let want = s.shift === 'midnight' ? Math.max(o.nightSnackCount, 0) + o.overtimeCount : base + o.overtimeCount;
        want = Math.max(want, o.ethnicCount);
        o.generatedCount = want;
        o.status = 'generated';
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

    this.logger.log(`种子完成：${today} 餐次3个、订餐7条、取餐${totalPicks}条、留样7份、异常5条`);
  }
}
