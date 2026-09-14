import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { ExtraMeal } from './extra-meal.entity';
import { Team } from './team.entity';

/**
 * 加餐配送点签收：一份加餐送达多个施工点时，逐点记录
 * 签收人、保温温度、送达/剩余数量与送达照片，防止某个班组漏领。
 */
@Entity('extra_meal_points')
export class ExtraMealPoint {
  @PrimaryGeneratedColumn() id: number;

  @Column() extraMealId: number;
  @ManyToOne(() => ExtraMeal, (e) => e.points, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'extraMealId' }) extraMeal: ExtraMeal;

  @Column({ type: 'int', nullable: true }) teamId: number;
  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'teamId' }) team: Team;

  @Column() pointName: string;          // 施工点，如 2#塔吊底部安全平台
  @Column({ default: '' }) route: string;
  @Column({ type: 'int', nullable: true }) stayMinutes: number; // 停留时间(分钟)

  @Column({ default: 0 }) sentCount: number;     // 送达份数
  @Column({ default: 0 }) receivedCount: number; // 已签收/领取份数
  @Column({ default: 0 }) remainingCount: number;// 剩余份数（漏领预警）
  @Column({ nullable: true }) receiver: string; // 签收人
  @Column({ nullable: true }) receiverPhone: string;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) temp: number; // 餐食温度℃
  @Column({ type: 'timestamptz', nullable: true }) arrivedAt: Date;
  @Column({ type: 'text', nullable: true }) photo: string; // 送达照片(dataURL)
  @Column({ default: 'pending' }) status: string; // pending / delivered / received
  @CreateDateColumn() createdAt: Date;
}
