import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Supplier } from './supplier.entity';

/**
 * 供应商食品安全档案事件：留样送检结果、暂停/恢复、追责扣款
 * 都同步到这里，形成供应商完整食安档案。
 */
@Entity('supplier_food_events')
export class SupplierFoodEvent {
  @PrimaryGeneratedColumn() id: number;

  @Column() supplierId: number;
  @ManyToOne(() => Supplier, (s) => s.foodEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' }) supplier: Supplier;

  /** lab_pass 检测合格 / lab_fail 检测不合格 / suspension 暂停供料 / resume 恢复 / penalty 追责扣款 */
  @Column() type: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) content: string;
  /** 关联追溯编号 TRACE-xxxx */
  @Column({ nullable: true }) traceCode: string;
  @Column({ nullable: true }) sampleBoxNo: string;
  @Column({ nullable: true }) dishName: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) amount: number;
  @CreateDateColumn() createdAt: Date;
}
