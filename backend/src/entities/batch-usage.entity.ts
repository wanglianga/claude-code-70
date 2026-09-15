import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { TraceEvent } from './trace-event.entity';
import { MealSession } from './meal-session.entity';
import { MealPreparation } from './meal-preparation.entity';

/**
 * 同批食材去向：留样送检期间，记录同批食材是否已用于其他餐次，
 * 明确供应商追责范围（受影响餐次/份数）。
 */
@Entity('trace_batch_usages')
export class BatchUsage {
  @PrimaryGeneratedColumn() id: number;

  @Column() traceEventId: number;
  @ManyToOne(() => TraceEvent, (e) => e.batchUsages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'traceEventId' }) traceEvent: TraceEvent;

  @Column() ingredientBatch: string;

  /** 该批次被用于的其他餐次 */
  @Column({ nullable: true }) sessionId: number;
  @ManyToOne(() => MealSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sessionId' }) session: MealSession;

  @Column({ nullable: true }) preparationId: number;
  @ManyToOne(() => MealPreparation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'preparationId' }) preparation: MealPreparation;

  @Column() dishName: string;
  @Column({ default: 0 }) usedCount: number;        // 使用份数
  @Column({ default: 'used' }) status: string;     // used 已使用 / sealed 已封存 / discarded 已销毁
  @Column({ default: '' }) riskNote: string;       // 风险研判（同批是否出现不适/已通知）
  @Column({ default: false }) exposed: boolean;    // 是否认定为受影响餐次（追责范围）
  @CreateDateColumn() createdAt: Date;
}
