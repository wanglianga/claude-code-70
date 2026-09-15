import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { TraceEvent } from './trace-event.entity';
import { User } from './user.entity';

/** 食品安全整改任务：事件处置中自动/手动生成，责任到人、限期闭环 */
@Entity('trace_rect_tasks')
export class RectificationTask {
  @PrimaryGeneratedColumn() id: number;

  @Column() traceEventId: number;
  @ManyToOne(() => TraceEvent, (e) => e.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'traceEventId' }) traceEvent: TraceEvent;

  @Column() title: string;
  @Column({ type: 'text', nullable: true }) detail: string;
  /** 整改类别：seal 封存食材 / disinfect 餐具环境消毒 / retrain 人员培训 / supplier 供应商整改 / recall 同批追回 / other */
  @Column({ default: 'other' }) category: string;

  @Column({ nullable: true }) assigneeId: number;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigneeId' }) assignee: User;
  @Column({ nullable: true }) assigneeName: string;

  @Column({ type: 'timestamptz', nullable: true }) dueAt: Date;
  /** open 待整改 / done 已完成 / verified 已验收 / overdue 逾期 */
  @Column({ default: 'open' }) status: string;
  @Column({ type: 'text', nullable: true }) result: string;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt: Date;

  @CreateDateColumn() createdAt: Date;
}
