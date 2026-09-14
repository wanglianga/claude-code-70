import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { MealPreparation } from './meal-preparation.entity';

/** 食品留样：48 小时冷藏、≥125g、记录留样人与温控 */
@Entity('food_samples')
export class FoodSample {
  @PrimaryGeneratedColumn() id: number;

  @Column() preparationId: number;
  @ManyToOne(() => MealPreparation, (p) => p.samples, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'preparationId' }) preparation: MealPreparation;

  @Column() dishName: string;            // 留样菜品
  @Column({ default: 125 }) weightGram: number;
  @Column({ nullable: true }) boxNo: string;       // 留样盒编号
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) fridgeTemp: number; // 冷藏温度
  @Column({ nullable: true }) sampledBy: string;   // 留样人
  @Column({ type: 'timestamptz', nullable: true }) sampleAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) expireAt: Date; // 48h 后
  @Column({ default: 'retained' }) status: string; // retained 留样中 / passed 检测合格 / failed 检测异常 / disposed 已处置
  @Column({ type: 'text', nullable: true }) labResult: string;
  @CreateDateColumn() createdAt: Date;
}
