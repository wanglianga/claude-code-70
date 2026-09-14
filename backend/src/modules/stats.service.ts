import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MealSession } from '../entities/meal-session.entity';
import { MealOrder } from '../entities/meal-order.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { MealPreparation } from '../entities/meal-preparation.entity';
import { FoodSample } from '../entities/food-sample.entity';
import { Incident } from '../entities/incident.entity';
import { Supplier } from '../entities/supplier.entity';
import { Team } from '../entities/team.entity';
import { MonthlyArchive } from '../entities/monthly-archive.entity';

export const INCIDENT_LABELS: Record<string, string> = {
  STOPWORK: '临时停工', TEAM_CHANGE: '班组人数变动', SHORTAGE: '菜品不够',
  SPOILED: '变质投诉', NIGHT_ZONE: '夜宵送塔吊区', SUBSIDY_DISPUTE: '补贴争议',
  RECEPTION: '临时接待', WEATHER: '高温/雨天', UNVERIFIED: '工人未实名', CROSS_TEAM: '跨班组取餐',
};

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(MealSession) private sessions: Repository<MealSession>,
    @InjectRepository(MealOrder) private orders: Repository<MealOrder>,
    @InjectRepository(MealPickup) private pickups: Repository<MealPickup>,
    @InjectRepository(MealPreparation) private preps: Repository<MealPreparation>,
    @InjectRepository(FoodSample) private samples: Repository<FoodSample>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(Team) private teams: Repository<Team>,
    @InjectRepository(MonthlyArchive) private archives: Repository<MonthlyArchive>,
  ) {}

  /** 汇总某月（默认取最近有数据的月份）全工地与分班组指标 */
  async dashboard(month?: string) {
    const allSessions = await this.sessions.find({});
    const m = month || (allSessions.sort((a, b) => b.date.localeCompare(a.date))[0]?.date?.slice(0, 7));
    const sessions = allSessions.filter((s) => !m || s.date.startsWith(m));
    const sids = sessions.map((s) => s.id);

    const orders = await this.orders.find({ where: { sessionId: In(sids.length ? sids : [0]) }, relations: ['team'] });
    const pickups = await this.pickups.find({ where: { sessionId: In(sids.length ? sids : [0]) }, relations: ['worker'] });
    const preps = await this.preps.find({ where: { sessionId: In(sids.length ? sids : [0]) } });
    const prepIds = preps.map((p) => p.id);
    const samples = prepIds.length
      ? await this.samples.find({ where: { preparationId: In(prepIds) } }) : [];
    const incidents = await this.incidents.find({});
    const monthIncidents = incidents.filter((i) => {
      const d = (i.createdAt ? new Date(i.createdAt) : new Date()).toISOString().slice(0, 7);
      return !m || d === m;
    });

    // ---- 全工地汇总 ----
    const orderCount = orders.reduce((a, o) => a + (o.generatedCount || o.headcount || 0), 0);
    const pickupCount = pickups.length;
    const prepLoss = preps.reduce((a, p) => a + (p.lossCount || 0), 0);
    const wasteCount = Math.max(orderCount - pickupCount, 0) + prepLoss;
    const money = pickups.reduce((a, p) => ({
      worker: a.worker + Number(p.workerSubsidy),
      company: a.company + Number(p.companySubsidy),
      self: a.self + Number(p.selfPay),
    }), { worker: 0, company: 0, self: 0 });

    const complaintTypes: Record<string, number> = {};
    for (const i of monthIncidents) {
      complaintTypes[i.type] = (complaintTypes[i.type] || 0) + 1;
    }

    // ---- 分班组：取餐率 / 浪费率（取餐数以实际取餐流水按取餐班组汇总，天然涵盖跨班组） ----
    const teamMap = new Map<number, any>();
    for (const o of orders) {
      const cur = teamMap.get(o.teamId) || {
        teamId: o.teamId, teamName: o.team?.name || `班组${o.teamId}`,
        orderCount: 0, generatedCount: 0, pickupCount: 0, ethnicCount: 0, nightCount: 0,
      };
      cur.orderCount += o.headcount || 0;
      cur.generatedCount += o.generatedCount || 0;
      cur.ethnicCount += o.ethnicCount || 0;
      cur.nightCount += o.nightSnackCount || 0;
      teamMap.set(o.teamId, cur);
    }
    const pickupByTeam: Record<number, number> = {};
    const moneyByTeam: Record<number, { worker: number; company: number; self: number }> = {};
    for (const p of pickups) {
      pickupByTeam[p.teamId] = (pickupByTeam[p.teamId] || 0) + 1;
      const mm = moneyByTeam[p.teamId] || { worker: 0, company: 0, self: 0 };
      mm.worker += Number(p.workerSubsidy); mm.company += Number(p.companySubsidy); mm.self += Number(p.selfPay);
      moneyByTeam[p.teamId] = mm;
    }
    for (const tid of Object.keys(pickupByTeam)) {
      if (!teamMap.has(+tid)) {
        teamMap.set(+tid, {
          teamId: +tid, teamName: `班组${tid}`, orderCount: 0, generatedCount: 0,
          pickupCount: 0, ethnicCount: 0, nightCount: 0,
        });
      }
      teamMap.get(+tid).pickupCount = pickupByTeam[+tid];
      const mm2 = moneyByTeam[+tid];
      teamMap.get(+tid).workerSubsidyTotal = +mm2.worker.toFixed(2);
      teamMap.get(+tid).companySubsidyTotal = +mm2.company.toFixed(2);
      teamMap.get(+tid).selfPayTotal = +mm2.self.toFixed(2);
    }
    const teams = [...teamMap.values()].map((t) => {
      const waste = Math.max(t.generatedCount - t.pickupCount, 0);
      return {
        ...t,
        wasteCount: waste,
        pickupRate: t.generatedCount ? +(t.pickupCount / t.generatedCount * 100).toFixed(1) : 0,
        wasteRate: t.generatedCount ? +(waste / t.generatedCount * 100).toFixed(1) : 0,
      };
    }).sort((a, b) => a.pickupRate - b.pickupRate);

    return {
      month: m,
      overview: {
        sessionCount: sessions.length,
        orderCount, pickupCount, wasteCount,
        pickupRate: orderCount ? +(pickupCount / orderCount * 100).toFixed(1) : 0,
        wasteRate: orderCount ? +(wasteCount / orderCount * 100).toFixed(1) : 0,
        sampleCount: samples.length,
        sampleRetained: samples.filter((s) => s.status === 'retained').length,
        samplePassed: samples.filter((s) => s.status === 'passed').length,
        sampleFailed: samples.filter((s) => s.status === 'failed').length,
        complaintCount: monthIncidents.length,
        openIncidents: monthIncidents.filter((i) => i.status === 'open').length,
        workerSubsidyTotal: +money.worker.toFixed(2),
        companySubsidyTotal: +money.company.toFixed(2),
        selfPayTotal: +money.self.toFixed(2),
        unverifiedPickups: pickups.filter((p) => p.unverified).length,
        crossTeamPickups: pickups.filter((p) => p.crossTeam).length,
      },
      teams,
      complaintTypes: Object.entries(complaintTypes).map(([type, count]) => ({
        type, label: INCIDENT_LABELS[type] || type, count,
      })).sort((a, b) => b.count - a.count),
    };
  }

  /** 生成/刷新月底结算后勤档案：全工地 + 每班组 */
  async settle(month: string) {
    const d = await this.dashboard(month);
    const suppliers = await this.suppliers.find();
    const supplierDeduction = suppliers.reduce((a, s) => a + (s.deduction || 0), 0);

    const rows: MonthlyArchive[] = [];
    const upsert = async (teamId: number, teamName: string, t: any, money: { worker: number; company: number; self: number }, siteWide: boolean) => {
      let rec = await this.archives.findOne({ where: { month, teamId } });
      if (!rec) rec = this.archives.create({ month, teamId });
      Object.assign(rec, {
        teamName,
        orderCount: t.orderCount, pickupCount: t.pickupCount, wasteCount: t.wasteCount,
        complaintCount: siteWide ? d.overview.complaintCount : 0,
        sampleCount: siteWide ? d.overview.sampleCount : 0,
        sampleFailed: siteWide ? d.overview.sampleFailed : 0,
        supplierDeduction: siteWide ? supplierDeduction : 0,
        workerSubsidyTotal: money.worker,
        companySubsidyTotal: money.company,
        selfPayTotal: money.self,
        pickupRate: t.pickupRate, wasteRate: t.wasteRate,
        settled: true,
      });
      rows.push(await this.archives.save(rec));
    };

    await upsert(0, '全工地', {
      orderCount: d.overview.orderCount, pickupCount: d.overview.pickupCount,
      wasteCount: d.overview.wasteCount, pickupRate: d.overview.pickupRate, wasteRate: d.overview.wasteRate,
    }, {
      worker: d.overview.workerSubsidyTotal, company: d.overview.companySubsidyTotal, self: d.overview.selfPayTotal,
    }, true);
    for (const t of d.teams) {
      // 分班组补贴按该班组实际取餐流水汇总
      await upsert(t.teamId, t.teamName, t, {
        worker: t.workerSubsidyTotal || 0, company: t.companySubsidyTotal || 0, self: t.selfPayTotal || 0,
      }, false);
    }
    return rows;
  }

  async listArchives(month?: string) {
    return this.archives.find({
      where: month ? { month } : {}, order: { month: 'DESC', teamId: 'ASC' },
    });
  }
}
