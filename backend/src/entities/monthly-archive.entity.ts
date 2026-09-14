import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 月底结算：订餐、取餐、补贴、报损、投诉、留样检测、供应商扣款
 * 汇入工地后勤档案（按月、按班组），用于控制浪费与保障食品安全。
 */
@Entity('monthly_archives')
export class MonthlyArchive {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 7 }) month: string;        // 2026-09
  @Column({ default: 0 }) teamId: number;       // 0 = 全工地汇总
  @Column({ default: '全工地' }) teamName: string;

  @Column({ default: 0 }) orderCount: number;     // 订餐份数
  @Column({ default: 0 }) pickupCount: number;    // 实际取餐份数
  @Column({ default: 0 }) wasteCount: number;     // 浪费/报损份数
  @Column({ default: 0 }) complaintCount: number; // 投诉数
  @Column({ default: 0 }) sampleCount: number;    // 留样数
  @Column({ default: 0 }) sampleFailed: number;   // 留样检测异常数
  @Column({ default: 0 }) supplierDeduction: number; // 供应商扣款（元）
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) workerSubsidyTotal: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) companySubsidyTotal: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) selfPayTotal: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 }) pickupRate: number; // 取餐率 %
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 }) wasteRate: number;  // 浪费率 %

  @Column({ default: false }) settled: boolean;
  @CreateDateColumn() createdAt: Date;
}
