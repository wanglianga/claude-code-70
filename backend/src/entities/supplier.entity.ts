import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { Canteen } from './canteen.entity';
import { SupplierFoodEvent } from './supplier-food-event.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ nullable: true }) contact: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) licenseNo: string; // 经营许可证
  @Column({ default: 0 }) deduction: number;    // 累计扣款（质量问题）

  /** 供餐资格：active 正常 / suspended 暂停供料（食品不适追溯期间项目部可暂停） */
  @Column({ default: 'active' }) status: string;
  @Column({ type: 'timestamptz', nullable: true }) suspendedAt: Date;
  @Column({ default: '' }) suspendReason: string;
  /** 暂停关联追溯事件编号（便于恢复时核对） */
  @Column({ nullable: true }) suspendTraceCode: string;

  @Column() canteenId: number;
  @ManyToOne(() => Canteen, (c) => c.suppliers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'canteenId' }) canteen: Canteen;

  /** 食品安全档案：留样送检结果/追责等事件 */
  @OneToMany(() => SupplierFoodEvent, (e) => e.supplier) foodEvents: SupplierFoodEvent[];

  @CreateDateColumn() createdAt: Date;
}
