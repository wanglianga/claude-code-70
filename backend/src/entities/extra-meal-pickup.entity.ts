import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { ExtraMeal } from './extra-meal.entity';
import { ExtraMealPoint } from './extra-meal-point.entity';
import { Worker } from './worker.entity';
import { Team } from './team.entity';

/** 加餐领取流水：谁在哪个施工点领取、费用如何分担（夜间加餐企业承担） */
@Entity('extra_meal_pickups')
export class ExtraMealPickup {
  @PrimaryGeneratedColumn() id: number;

  @Column() extraMealId: number;
  @ManyToOne(() => ExtraMeal, (e) => e.pickups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'extraMealId' }) extraMeal: ExtraMeal;

  @Column({ type: 'int', nullable: true }) pointId: number;
  @ManyToOne(() => ExtraMealPoint, { nullable: true })
  @JoinColumn({ name: 'pointId' }) point: ExtraMealPoint;

  @Column() workerId: number;
  @ManyToOne(() => Worker)
  @JoinColumn({ name: 'workerId' }) worker: Worker;

  @Column() teamId: number;
  @ManyToOne(() => Team)
  @JoinColumn({ name: 'teamId' }) team: Team;

  @Column({ default: 'face' }) method: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) price: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) workerSubsidy: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) companySubsidy: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) selfPay: number;
  @Column({ nullable: true }) operator: string;
  @CreateDateColumn() createdAt: Date;
}
