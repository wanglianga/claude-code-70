import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { TraceEvent } from './trace-event.entity';
import { User } from './user.entity';

/** 追溯事件处置时间线：暂停供应商/送检/通知/停餐/检测结果/整改等动作留痕 */
@Entity('trace_actions')
export class TraceAction {
  @PrimaryGeneratedColumn() id: number;

  @Column() traceEventId: number;
  @ManyToOne(() => TraceEvent, (e) => e.actions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'traceEventId' }) traceEvent: TraceEvent;

  @Column() actorId: number;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'actorId' }) actor: User;
  @Column() actorRole: string;

  /**
   * create 建档 / report 个案报告 / notify 通知同餐次 / observe 停餐观察 /
   * suspend_supplier 暂停供应商 / resume_supplier 恢复 / submit_sample 送检 /
   * lab_result 检测结果 / batch_scan 同批追踪 / task_create 整改任务 /
   * task_done / task_verify / close 结案 / comment
   */
  @Column({ default: 'comment' }) action: string;
  @Column({ type: 'text' }) content: string;
  @CreateDateColumn() createdAt: Date;
}
