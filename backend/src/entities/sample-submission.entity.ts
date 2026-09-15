import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { TraceEvent } from './trace-event.entity';
import { FoodSample } from './food-sample.entity';
import { User } from './user.entity';

/**
 * 留样送检单：把 48h 留样送第三方检测机构。
 * 结果（合格/不合格）回写留样状态与供应商档案。
 */
@Entity('trace_submissions')
export class SampleSubmission {
  @PrimaryGeneratedColumn() id: number;

  @Column() traceEventId: number;
  @ManyToOne(() => TraceEvent, (e) => e.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'traceEventId' }) traceEvent: TraceEvent;

  /** 关联留样（food_samples.id），送检后留样状态变 testing */
  @Column({ nullable: true }) sampleId: number;
  @ManyToOne(() => FoodSample, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sampleId' }) sample: FoodSample;

  /** 冗余留样编号/菜品，留样被处置后仍可查 */
  @Column({ nullable: true }) sampleBoxNo: string;
  @Column() dishName: string;

  @Column({ nullable: true }) labName: string;        // 检测机构
  @Column({ nullable: true }) labContact: string;
  /** 检测项目：菌落总数 / 大肠菌群 / 沙门氏菌 / 金黄色葡萄球菌 … */
  @Column({ default: '' }) testItems: string;
  @Column({ type: 'timestamptz', nullable: true }) sentAt: Date;
  @Column({ nullable: true }) sentBy: string;

  /** pending 待送检 / testing 检测中 / passed 合格 / failed 不合格 */
  @Column({ default: 'pending' }) result: string;
  @Column({ type: 'text', nullable: true }) labReport: string;
  @Column({ type: 'timestamptz', nullable: true }) resultedAt: Date;

  /** 检测结果是否已同步到供应商档案 */
  @Column({ default: false }) syncedToSupplier: boolean;

  @Column({ nullable: true }) operatorId: number;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'operatorId' }) operator: User;

  @CreateDateColumn() createdAt: Date;
}
