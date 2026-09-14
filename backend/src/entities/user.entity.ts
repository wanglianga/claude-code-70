import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { Worker } from './worker.entity';
import { MealOrder } from './meal-order.entity';

/** 角色：ADMIN 平台管理员 / FOREMAN 班组长 / CANTEEN 食堂 / PROJECT 项目部 / FINANCE 财务 / SAFETY 安全员 / WORKER 工人 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) username: string;
  @Column() password: string;
  @Column() name: string;
  @Column() role: string;
  @Column({ nullable: true }) phone: string;
  @CreateDateColumn() createdAt: Date;

  @OneToMany(() => Worker, (w) => w.user) workers: Worker[];
  @OneToMany(() => MealOrder, (o) => o.foreman) orders: MealOrder[];
}
