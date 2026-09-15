import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { Worker } from '../entities/worker.entity';
import { Attendance } from '../entities/attendance.entity';
import { ConstructionPlan } from '../entities/construction-plan.entity';
import { Canteen } from '../entities/canteen.entity';
import { Supplier } from '../entities/supplier.entity';
import { SupplierFoodEvent } from '../entities/supplier-food-event.entity';

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Team) private teams: Repository<Team>,
    @InjectRepository(Worker) private workers: Repository<Worker>,
    @InjectRepository(Attendance) private attendance: Repository<Attendance>,
    @InjectRepository(ConstructionPlan) private plans: Repository<ConstructionPlan>,
    @InjectRepository(Canteen) private canteens: Repository<Canteen>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(SupplierFoodEvent) private supplierFoodEvents: Repository<SupplierFoodEvent>,
  ) {}

  // ---------- 班组 ----------
  listTeams() {
    return this.teams.find({ order: { id: 'ASC' } });
  }

  async teamDetail(id: number) {
    const team = await this.teams.findOne({ where: { id }, relations: ['workers'] });
    if (!team) throw new NotFoundException('班组不存在');
    const verified = team.workers.filter((w) => w.verified).length;
    return { ...team, workerCount: team.workers.length, verifiedCount: verified };
  }

  createTeam(dto: Partial<Team>) {
    return this.teams.save(this.teams.create(dto));
  }

  // ---------- 工人 ----------
  listWorkers(teamId?: number, verified?: boolean) {
    const where: any = {};
    if (teamId) where.teamId = teamId;
    if (verified !== undefined) where.verified = verified;
    return this.workers.find({ where, relations: ['team'], order: { id: 'ASC' } });
  }

  createWorker(dto: Partial<Worker>) {
    const w = this.workers.create({
      ...dto,
      pickupCode: dto.pickupCode || 'P' + String(Date.now()).slice(-8),
      verified: dto.verified ?? false,
    });
    return this.workers.save(w);
  }

  /** 新工人实名登记：补身份证、人脸，置为已实名 */
  async verifyWorker(id: number, dto: { idCard?: string; faceToken?: string }) {
    const w = await this.workers.findOne({ where: { id } });
    if (!w) throw new NotFoundException('工人不存在');
    w.idCard = dto.idCard || w.idCard;
    w.faceToken = dto.faceToken || w.faceToken || 'FACE-' + id;
    w.verified = true;
    return this.workers.save(w);
  }

  /** 跨班组调动 */
  async transferWorker(id: number, teamId: number) {
    const w = await this.workers.findOne({ where: { id } });
    if (!w) throw new NotFoundException('工人不存在');
    w.teamId = teamId;
    return this.workers.save(w);
  }

  // ---------- 实名考勤 ----------
  async listAttendance(date: string, shift?: string) {
    const rows = await this.attendance.find({
      where: { date, ...(shift ? { shift } : {}) },
      relations: ['worker', 'worker.team'],
    });
    return rows;
  }

  async setAttendance(date: string, rows: Array<{ workerId: number; shift?: string; present?: boolean; location?: string }>) {
    const saved = [];
    for (const r of rows) {
      let rec = await this.attendance.findOne({
        where: { workerId: r.workerId, date, shift: r.shift || 'day' },
      });
      if (!rec) {
        rec = this.attendance.create({ workerId: r.workerId, date, shift: r.shift || 'day' });
      }
      rec.present = r.present ?? true;
      rec.location = r.location || rec.location || '';
      saved.push(await this.attendance.save(rec));
    }
    return saved;
  }

  /** 当日某班次各班组在岗人数（订餐生成的核心输入之一） */
  async presentCounts(date: string, shift: string) {
    const rows = await this.attendance.find({
      where: { date, shift, present: true },
      relations: ['worker'],
    });
    const map: Record<number, number> = {};
    for (const r of rows) map[r.worker.teamId] = (map[r.worker.teamId] || 0) + 1;
    return map;
  }

  /** 当日某班次各班组施工计划上岗人数（订餐生成来源之一） */
  async planCounts(date: string, shift: string) {
    const rows = await this.plans.find({ where: { date, shift } });
    const map: Record<number, ConstructionPlan> = {};
    for (const r of rows) map[r.teamId] = r;
    return map;
  }

  async listPlans(date: string, shift?: string) {
    return this.plans.find({
      where: { date, ...(shift ? { shift } : {}) },
      relations: ['team'], order: { shift: 'ASC', teamId: 'ASC' },
    });
  }

  /** 批量保存施工计划（按 date+shift+team 唯一） */
  async savePlans(date: string, rows: Array<{ teamId: number; shift?: string; plannedWorkers: number; workArea?: string; nightWork?: boolean; note?: string }>) {
    const saved = [];
    for (const r of rows) {
      const shift = r.shift || 'day';
      let rec = await this.plans.findOne({ where: { date, shift, teamId: r.teamId } });
      if (!rec) rec = this.plans.create({ date, shift, teamId: r.teamId });
      rec.plannedWorkers = +r.plannedWorkers || 0;
      rec.workArea = r.workArea || rec.workArea || '';
      rec.nightWork = r.nightWork ?? rec.nightWork ?? false;
      rec.note = r.note ?? rec.note;
      saved.push(await this.plans.save(rec));
    }
    return saved;
  }

  /** 更新班组（宿舍人数等），用于验证宿舍人数参与订餐生成 */
  async updateTeam(id: number, dto: Partial<Team>) {
    const t = await this.teams.findOne({ where: { id } });
    if (!t) throw new NotFoundException('班组不存在');
    if (dto.name !== undefined) t.name = dto.name;
    if (dto.trade !== undefined) t.trade = dto.trade;
    if (dto.dormHeadcount !== undefined) t.dormHeadcount = +dto.dormHeadcount;
    return this.teams.save(t);
  }

  /** 更新食堂（产能、夜宵值班、食材余量等），用于验证产能硬约束与加餐检查 */
  async updateCanteen(id: number, dto: Partial<Canteen>) {
    const c = await this.canteens.findOne({ where: { id } });
    if (!c) throw new NotFoundException('食堂不存在');
    const fields: (keyof Canteen)[] = [
      'name', 'capacity', 'outsourced', 'vendorScore',
      'nightDuty', 'nightDutyChef', 'nightDutyPhone', 'ingredientStock',
    ];
    for (const f of fields) {
      if (dto[f] !== undefined) (c as any)[f] = dto[f];
    }
    return this.canteens.save(c);
  }

  // ---------- 食堂 / 供应商 ----------
  listCanteens() {
    return this.canteens.find({ relations: ['suppliers'], order: { id: 'ASC' } });
  }

  createCanteen(dto: Partial<Canteen>) {
    return this.canteens.save(this.canteens.create(dto));
  }

  listSuppliers(canteenId?: number) {
    return this.suppliers.find({
      where: canteenId ? { canteenId } : {},
      relations: ['foodEvents'],
      order: { id: 'ASC' },
    });
  }

  createSupplier(dto: Partial<Supplier>) {
    return this.suppliers.save(this.suppliers.create(dto));
  }
}
