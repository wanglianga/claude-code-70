import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Worker } from './worker.entity';
import { Team } from './team.entity';
import { MealSession } from './meal-session.entity';

/** 取餐流水：刷脸 / 扫码；核算个人餐补、企业补贴、自费 */
@Entity('meal_pickups')
export class MealPickup {
  @PrimaryGeneratedColumn() id: number;

  @Column() sessionId: number;
  @ManyToOne(() => MealSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' }) session: MealSession;

  @Column() workerId: number;
  @ManyToOne(() => Worker, (w) => w.pickups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' }) worker: Worker;

  @Column() teamId: number;
  @ManyToOne(() => Team, (t) => t.pickups)
  @JoinColumn({ name: 'teamId' }) team: Team;

  @Column({ default: 'face' }) method: string;  // face 刷脸 / code 扫码 / manual 人工
  @Column({ default: false }) crossTeam: boolean; // 是否跨班组取餐
  @Column({ default: false }) unverified: boolean;// 是否未实名工人
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) price: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) workerSubsidy: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) companySubsidy: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) selfPay: number;
  @Column({ nullable: true }) operator: string;
  @CreateDateColumn() createdAt: Date;
}
