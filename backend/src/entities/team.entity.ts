import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Worker } from './worker.entity';
import { MealOrder } from './meal-order.entity';
import { MealPickup } from './meal-pickup.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;               // 如：钢筋一班
  @Column({ default: '' }) trade: string; // 主要工种
  @Column({ default: 0 }) dormHeadcount: number; // 宿舍登记人数
  @Column({ nullable: true }) leaderUserId: number;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'leaderUserId' }) leader: User;

  @OneToMany(() => Worker, (w) => w.team) workers: Worker[];
  @OneToMany(() => MealOrder, (o) => o.team) orders: MealOrder[];
  @OneToMany(() => MealPickup, (p) => p.team) pickups: MealPickup[];
  @CreateDateColumn() createdAt: Date;
}
