import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { Canteen } from './canteen.entity';
import { MealOrder } from './meal-order.entity';
import { MealPreparation } from './meal-preparation.entity';
import { MealDelivery } from './meal-delivery.entity';

/** 餐次：某日期某班次，如 2026-09-14 晚餐 / 夜宵 */
@Entity('meal_sessions')
export class MealSession {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) date: string;
  @Column() shift: string;        // lunch 午餐 / dinner 晚餐 / midnight 夜宵 / breakfast 早餐
  @Column() canteenId: number;
  @ManyToOne(() => Canteen, (c) => c.sessions)
  @JoinColumn({ name: 'canteenId' }) canteen: Canteen;

  @Column({ default: 'open' }) status: string; // open 订餐中 / confirmed 已生成 / preparing 备餐中 / serving 分餐中 / closed 已结束 / stopped 停工取消

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 15 }) price: number;        // 餐标
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 8 }) workerSubsidy: number; // 个人餐补（农民工补贴）
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 5 }) companySubsidy: number;// 企业补贴
  @Column({ default: '' }) weather: string;   // 高温 / 雨 / 晴
  @Column({ type: 'text', nullable: true }) note: string;
  @CreateDateColumn() createdAt: Date;

  @OneToMany(() => MealOrder, (o) => o.session) orders: MealOrder[];
  @OneToMany(() => MealPreparation, (p) => p.session) preparations: MealPreparation[];
  @OneToMany(() => MealDelivery, (d) => d.session) deliveries: MealDelivery[];
}
