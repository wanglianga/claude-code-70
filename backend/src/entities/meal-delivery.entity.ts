import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { MealSession } from './meal-session.entity';

/** 送餐记录：夜间分散施工点 / 塔吊作业区，路线 + 保温温度（结合安全管理） */
@Entity('meal_deliveries')
export class MealDelivery {
  @PrimaryGeneratedColumn() id: number;

  @Column() sessionId: number;
  @ManyToOne(() => MealSession, (s) => s.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' }) session: MealSession;

  @Column() zone: string;              // 送达作业区
  @Column({ nullable: true }) route: string;        // 送餐路线
  @Column({ default: 0 }) count: number;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) keepWarmTemp: number; // 保温温度
  @Column({ nullable: true }) carrier: string;      // 配送员
  @Column({ nullable: true }) safetyCheck: string;  // 安全确认（封闭区/高空/雨天）
  @Column({ type: 'timestamptz', nullable: true }) departAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) arriveAt: Date;
  @Column({ default: 'planned' }) status: string; // planned / in_transit / delivered
  @CreateDateColumn() createdAt: Date;
}
