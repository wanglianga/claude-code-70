import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { MealSession } from './meal-session.entity';
import { User } from './user.entity';
import { Supplier } from './supplier.entity';
import { DiscomfortReport } from './discomfort-report.entity';
import { ContactPerson } from './contact-person.entity';
import { SampleSubmission } from './sample-submission.entity';
import { BatchUsage } from './batch-usage.entity';
import { RectificationTask } from './rectification-task.entity';
import { TraceAction } from './trace-action.entity';

/**
 * 食品不适追溯事件：多名工人反馈腹痛/呕吐时，围绕同一餐次集中追溯。
 * 状态：investigating 调查中 / testing 留样送检中 / rectifying 整改中 / closed 已结案
 */
@Entity('trace_events')
export class TraceEvent {
  @PrimaryGeneratedColumn() id: number;

  /** 追溯编号 TRACE-yyyymmdd-xx，便于线下登记/归档 */
  @Column({ unique: true }) code: string;

  @Column() title: string;
  @Column({ type: 'text' }) description: string;
  @Column({ default: 'investigating' }) status: string;
  @Column({ default: 'high' }) severity: string; // low / medium / high

  /** 取餐时间（工人反馈的大致取餐时段） */
  @Column({ type: 'timestamptz', nullable: true }) mealTime: Date;
  /** 涉事菜品（报告时汇总，逗号分隔，如 红烧鸡腿,番茄蛋汤） */
  @Column({ default: '' }) dishes: string;
  /** 涉事班组（逗号分隔的班组名，冗余便于列表展示） */
  @Column({ default: '' }) teamNames: string;
  /** 留样编号（多个留样盒编号，逗号分隔） */
  @Column({ default: '' }) sampleBoxNos: string;

  /** 关联餐次（同餐次 = 同 sessionId 的取餐流水） */
  @Column({ nullable: true }) sessionId: number;
  @ManyToOne(() => MealSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sessionId' }) session: MealSession;

  /** 主要涉事食材批次（同批食材追踪用） */
  @Column({ nullable: true }) ingredientBatch: string;
  /** 主要涉事供应商（项目部暂停时设置） */
  @Column({ nullable: true }) supplierId: number;
  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplierId' }) supplier: Supplier;

  @Column({ nullable: true }) reporterId: number;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reporterId' }) reporter: User;

  /** 是否已通知同餐次人员 / 是否已停餐观察（由名单动作驱动，冗余给看板统计） */
  @Column({ default: false }) notified: boolean;
  @Column({ default: false }) mealSuspended: boolean;

  /** 结案结论 / 责任供应商 / 追责金额 */
  @Column({ type: 'text', nullable: true }) conclusion: string;
  @Column({ nullable: true }) responsibleParty: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) penaltyAmount: number;
  @Column({ type: 'timestamptz', nullable: true }) closedAt: Date;

  @OneToMany(() => DiscomfortReport, (r) => r.traceEvent) reports: DiscomfortReport[];
  @OneToMany(() => ContactPerson, (p) => p.traceEvent) contacts: ContactPerson[];
  @OneToMany(() => SampleSubmission, (s) => s.traceEvent) submissions: SampleSubmission[];
  @OneToMany(() => BatchUsage, (b) => b.traceEvent) batchUsages: BatchUsage[];
  @OneToMany(() => RectificationTask, (t) => t.traceEvent) tasks: RectificationTask[];
  @OneToMany(() => TraceAction, (a) => a.traceEvent) actions: TraceAction[];

  @CreateDateColumn() createdAt: Date;
}
