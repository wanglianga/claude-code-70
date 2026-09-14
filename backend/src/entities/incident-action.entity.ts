import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Incident } from './incident.entity';
import { User } from './user.entity';

/** 异常协同的多方处理动作（班组长、食堂、项目部、财务、安全员在同一餐次内的响应） */
@Entity('incident_actions')
export class IncidentAction {
  @PrimaryGeneratedColumn() id: number;

  @Column() incidentId: number;
  @ManyToOne(() => Incident, (i) => i.actions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' }) incident: Incident;

  @Column() actorId: number;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'actorId' }) actor: User;

  @Column() actorRole: string;
  @Column({ type: 'text' }) content: string;
  @Column({ default: '' }) action: string; // 例如：confirm_stopwork / adjust_order / deduct / safety_approve
  @CreateDateColumn() createdAt: Date;
}
