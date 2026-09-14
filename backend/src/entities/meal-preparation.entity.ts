import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { MealSession } from './meal-session.entity';
import { Supplier } from './supplier.entity';
import { FoodSample } from './food-sample.entity';

/** 备餐记录：菜单 / 食材批次 / 供应商 / 厨师 / 温控 / 分餐时间 */
@Entity('meal_preparations')
export class MealPreparation {
  @PrimaryGeneratedColumn() id: number;

  @Column() sessionId: number;
  @ManyToOne(() => MealSession, (s) => s.preparations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' }) session: MealSession;

  @Column({ type: 'text' }) menu: string;            // 菜单
  @Column({ nullable: true }) ingredientBatch: string; // 食材批次号
  @Column({ nullable: true }) supplierId: number;
  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplierId' }) supplier: Supplier;

  @Column({ nullable: true }) chef: string;          // 厨师
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) coreTemp: number;  // 中心温度 ℃
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) ambientTemp: number;// 环境温度
  @Column({ nullable: true }) cookTime: string;      // 烹饪完成时间
  @Column({ nullable: true }) serveTime: string;     // 分餐时间
  @Column({ default: 0 }) preparedCount: number;     // 实际备餐份数
  @Column({ default: 0 }) shortageCount: number;     // 菜品不够缺口
  @Column({ default: 0 }) lossCount: number;         // 报损份数
  @Column({ type: 'text', nullable: true }) note: string;
  @CreateDateColumn() createdAt: Date;

  @OneToMany(() => FoodSample, (s) => s.preparation) samples: FoodSample[];
}
