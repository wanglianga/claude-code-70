import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { TraceEvent } from './trace-event.entity';
import { Worker } from './worker.entity';
import { Team } from './team.entity';
import { User } from './user.entity';

/**
 * 工人个案不适报告：多名工人反馈腹痛/呕吐，逐人收集
 * 取餐时间、菜品、班组、留样编号与就医记录。
 */
@Entity('trace_reports')
export class DiscomfortReport {
  @PrimaryGeneratedColumn() id: number;

  @Column() traceEventId: number;
  @ManyToOne(() => TraceEvent, (e) => e.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'traceEventId' }) traceEvent: TraceEvent;

  @Column({ nullable: true }) workerId: number;
  @ManyToOne(() => Worker, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'workerId' }) worker: Worker;

  /** 未实名/外来人员可直接填姓名 */
  @Column() workerName: string;
  @Column({ nullable: true }) teamId: number;
  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' }) team: Team;

  /** 症状（多选逗号分隔）：abdominal_pain 腹痛 / vomiting 呕吐 / diarrhea 腹泻 / fever 发热 / nausea 恶心 / dizziness 头晕 */
  @Column({ default: '' }) symptoms: string;
  /** 发病时间 / 报告取餐时间 */
  @Column({ type: 'timestamptz', nullable: true }) onsetAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) pickupAt: Date;
  /** 自述食用菜品 */
  @Column({ default: '' }) dishes: string;
  /** 关联留样编号（留样盒号） */
  @Column({ nullable: true }) sampleBoxNo: string;

  /** 就医记录 */
  @Column({ default: 'none' }) medicalStatus: string; // none 未就医 / outpatient 门诊 / inpatient 住院 / observation 现场医务观察
  @Column({ nullable: true }) hospital: string;
  @Column({ nullable: true }) diagnosis: string;
  @Column({ type: 'timestamptz', nullable: true }) visitedAt: Date;
  @Column({ default: '' }) medicalNote: string;

  /** 个案状态：reported 已报告 / following 回访中 / recovered 已康复 / hospitalized 住院中 */
  @Column({ default: 'reported' }) status: string;

  @Column({ nullable: true }) recorderId: number;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recorderId' }) recorder: User;

  @CreateDateColumn() createdAt: Date;
}
