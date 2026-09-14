import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Canteen } from './canteen.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ nullable: true }) contact: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) licenseNo: string; // 经营许可证
  @Column({ default: 0 }) deduction: number;    // 累计扣款（质量问题）
  @Column() canteenId: number;
  @ManyToOne(() => Canteen, (c) => c.suppliers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'canteenId' }) canteen: Canteen;
  @CreateDateColumn() createdAt: Date;
}
