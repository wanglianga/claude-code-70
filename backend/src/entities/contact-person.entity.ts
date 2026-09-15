import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { TraceEvent } from './trace-event.entity';
import { Worker } from './worker.entity';
import { Team } from './team.entity';

/**
 * 同餐次人员名单：从取餐流水自动生成，用于回访与停餐观察。
 */
@Entity('trace_contacts')
export class ContactPerson {
  @PrimaryGeneratedColumn() id: number;

  @Column() traceEventId: number;
  @ManyToOne(() => TraceEvent, (e) => e.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'traceEventId' }) traceEvent: TraceEvent;

  @Column({ nullable: true }) workerId: number;
  @ManyToOne(() => Worker, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'workerId' }) worker: Worker;

  @Column() workerName: string;
  @Column({ nullable: true }) teamId: number;
  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'teamId' }) team: Team;

  @Column({ nullable: true }) phone: string;
  /** 取餐方式 face 刷脸 / code 扫码 / manual 人工 */
  @Column({ default: 'face' }) pickupMethod: string;
  @Column({ type: 'timestamptz', nullable: true }) pickupAt: Date;

  /** 是否同时是不适报告人（自动标记） */
  @Column({ default: false }) symptomatic: boolean;

  /** 通知状态：pending 待通知 / notified 已通知 / unreachable 联系不上 */
  @Column({ default: 'pending' }) notifyStatus: string;
  @Column({ type: 'timestamptz', nullable: true }) notifiedAt: Date;
  @Column({ default: '' }) notifyChannel: string; // 电话/短信/班组长转达

  /** 停餐观察状态：none 无需 / observing 观察中 / resumed 已恢复供餐 / confirmed_sick 确认发病就医 */
  @Column({ default: 'none' }) observeStatus: string;
  @Column({ type: 'timestamptz', nullable: true }) observeUntil: Date;
  /** 回访结果（无症状/轻微腹泻已缓解/送医…） */
  @Column({ type: 'text', nullable: true }) followUpResult: string;
  @Column({ type: 'timestamptz', nullable: true }) followedAt: Date;

  @CreateDateColumn() createdAt: Date;
}
