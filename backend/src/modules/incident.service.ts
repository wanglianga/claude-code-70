import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from '../entities/incident.entity';
import { IncidentAction } from '../entities/incident-action.entity';
import { MealSession } from '../entities/meal-session.entity';
import { MealOrder } from '../entities/meal-order.entity';
import { Supplier } from '../entities/supplier.entity';

/** 异常类型 -> 应在同一餐次协同处理的角色 */
const TYPE_ROLES: Record<string, string[]> = {
  STOPWORK: ['FOREMAN', 'PROJECT', 'CANTEEN', 'FINANCE'],
  TEAM_CHANGE: ['FOREMAN', 'PROJECT', 'CANTEEN'],
  SHORTAGE: ['CANTEEN', 'FOREMAN', 'PROJECT'],
  SPOILED: ['CANTEEN', 'SAFETY', 'FINANCE', 'PROJECT'],
  NIGHT_ZONE: ['FOREMAN', 'CANTEEN', 'SAFETY'],
  SUBSIDY_DISPUTE: ['FOREMAN', 'FINANCE', 'PROJECT'],
  RECEPTION: ['PROJECT', 'CANTEEN', 'FINANCE'],
  WEATHER: ['CANTEEN', 'SAFETY', 'FOREMAN'],
  UNVERIFIED: ['FOREMAN', 'PROJECT'],
  CROSS_TEAM: ['FOREMAN', 'CANTEEN', 'FINANCE'],
};

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    @InjectRepository(IncidentAction) private actions: Repository<IncidentAction>,
    @InjectRepository(MealSession) private sessions: Repository<MealSession>,
    @InjectRepository(MealOrder) private orders: Repository<MealOrder>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
  ) {}

  async list(status?: string, type?: string) {
    const list = await this.incidents.find({
      where: { ...(status ? { status } : {}), ...(type ? { type } : {}) },
      relations: ['reporter', 'session', 'actions', 'actions.actor'],
      order: { id: 'DESC' },
    });
    return list;
  }

  async create(dto: any, user: { sub: number; role: string }) {
    const involved = dto.involvedRoles
      ? String(dto.involvedRoles).split(',').map((s) => s.trim()).filter(Boolean)
      : (TYPE_ROLES[dto.type] || ['FOREMAN', 'CANTEEN', 'PROJECT']);
    if (!involved.includes(user.role)) involved.unshift(user.role);

    const inc = this.incidents.create({
      sessionId: dto.sessionId || null,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      severity: dto.severity || 'medium',
      reporterId: user.sub,
      involvedRoles: involved.join(','),
      status: 'open',
    });
    const saved = await this.incidents.save(inc);
    await this.actions.save(this.actions.create({
      incidentId: saved.id, actorId: user.sub, actorRole: user.role,
      content: dto.description, action: 'create',
    }));
    return this.detail(saved.id);
  }

  async detail(id: number) {
    const inc = await this.incidents.findOne({
      where: { id },
      relations: ['reporter', 'session', 'actions', 'actions.actor'],
    });
    if (!inc) throw new NotFoundException('异常不存在');
    return inc;
  }

  /** 各角色在同一异常/餐次内追加处理动作 */
  async addAction(id: number, dto: { content: string; action?: string }, user: { sub: number; role: string }) {
    const inc = await this.incidents.findOne({ where: { id } });
    if (!inc) throw new NotFoundException('异常不存在');
    const a = await this.actions.save(this.actions.create({
      incidentId: id, actorId: user.sub, actorRole: user.role,
      content: dto.content, action: dto.action || 'comment',
    }));

    // 联动业务：停工取消餐次 / 调整订餐 / 供应商扣款
    if (dto.action === 'confirm_stopwork' && inc.sessionId) {
      await this.sessions.update(inc.sessionId, { status: 'stopped' });
    }
    if (dto.action === 'adjust_order') {
      // 内容约定：teamId:newCount，如 "3:20"
      const m = /(\d+)\s*[:：]\s*(\d+)/.exec(dto.content);
      if (m) {
        const order = await this.orders.findOne({ where: { sessionId: inc.sessionId, teamId: +m[1] } });
        if (order) { order.generatedCount = +m[2]; order.status = 'adjusted'; await this.orders.save(order); }
      }
    }
    if (dto.action === 'deduct_supplier') {
      const m = /(\d+)\s*[:：]\s*(\d+(?:\.\d+)?)/.exec(dto.content); // supplierId:金额
      if (m) {
        const sup = await this.suppliers.findOne({ where: { id: +m[1] } });
        if (sup) { sup.deduction = +(sup.deduction + +m[2]).toFixed(2); await this.suppliers.save(sup); }
      }
    }
    return this.detail(id);
  }

  /** 结案：记录结论、责任方与调整金额（如补贴争议补发/扣回） */
  async resolve(id: number, dto: { resolution: string; responsibleParty?: string; adjustmentAmount?: number }) {
    const inc = await this.incidents.findOne({ where: { id } });
    if (!inc) throw new NotFoundException('异常不存在');
    inc.status = 'resolved';
    inc.resolution = dto.resolution;
    inc.responsibleParty = dto.responsibleParty || inc.responsibleParty;
    inc.adjustmentAmount = dto.adjustmentAmount ?? inc.adjustmentAmount;
    await this.incidents.save(inc);
    return this.detail(id);
  }

  async reopen(id: number) {
    const inc = await this.incidents.findOne({ where: { id } });
    if (!inc) throw new NotFoundException('异常不存在');
    inc.status = 'open';
    await this.incidents.save(inc);
    return this.detail(id);
  }
}
