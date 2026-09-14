import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { MealSession } from './meal-session.entity';
import { Supplier } from './supplier.entity';

/** 食堂（可能为外包） */
@Entity('canteens')
export class Canteen {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ default: 0 }) capacity: number;       // 单餐产能（份）
  @Column({ default: false }) outsourced: boolean; // 是否外包
  @Column({ nullable: true }) manager: string;    // 厨师长/负责人
  @Column({ nullable: true }) phone: string;
  @Column({ default: 90 }) vendorScore: number;   // 外包考核分
  @CreateDateColumn() createdAt: Date;

  @OneToMany(() => MealSession, (s) => s.canteen) sessions: MealSession[];
  @OneToMany(() => Supplier, (s) => s.canteen) suppliers: Supplier[];
}
