import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { Worker } from '../entities/worker.entity';
import { Attendance } from '../entities/attendance.entity';
import { Canteen } from '../entities/canteen.entity';
import { Supplier } from '../entities/supplier.entity';

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Team) private teams: Repository<Team>,
    @InjectRepository(Worker) private workers: Repository<Worker>,
    @InjectRepository(Attendance) private attendance: Repository<Attendance>,
    @InjectRepository(Canteen) private canteens: Repository<Canteen>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
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

  // ---------- 食堂 / 供应商 ----------
  listCanteens() {
    return this.canteens.find({ relations: ['suppliers'], order: { id: 'ASC' } });
  }

  createCanteen(dto: Partial<Canteen>) {
    return this.canteens.save(this.canteens.create(dto));
  }

  listSuppliers(canteenId?: number) {
    return this.suppliers.find({ where: canteenId ? { canteenId } : {}, order: { id: 'ASC' } });
  }

  createSupplier(dto: Partial<Supplier>) {
    return this.suppliers.save(this.suppliers.create(dto));
  }
}
