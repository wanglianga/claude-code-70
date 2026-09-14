import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { MealSession } from './meal-session.entity';
import { Canteen } from './canteen.entity';
import { User } from './user.entity';
import { ExtraMealPoint } from './extra-meal-point.entity';
import { ExtraMealPickup } from './extra-meal-pickup.entity';

/**
 * 夜间加班临时加餐申请单。
 * 由班组长发起，平台检查【食堂值班、食材余量、配送点、餐补规则】后流转：
 *   draft 草稿 -> checked 已校验 -> safety_confirmed 安全员确认(高风险) ->
 *   canteen_confirmed 食堂已备 -> delivering 配送中 -> received 已签收 -> closed 已关闭
 * 费用、领取人员、送达照片归入夜宵餐次。
 */
@Entity('extra_meals')
export class ExtraMeal {
  @PrimaryGeneratedColumn() id: number;

  /** 归入的夜宵餐次（加餐作为夜宵餐次的追加） */
  @Column() sessionId: number;
  @ManyToOne(() => MealSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' }) session: MealSession;

  @Column() canteenId: number;
  @ManyToOne(() => Canteen)
  @JoinColumn({ name: 'canteenId' }) canteen: Canteen;

  /** 发起班组长 */
  @Column() requesterId: number;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'requesterId' }) requester: User;

  @Column({ length: 20 }) date: string;
  @Column({ default: '' }) reason: string;         // 如：混凝土浇筑到深夜
  @Column({ default: 0 }) requestedCount: number;  // 申请份数
  @Column({ default: 0 }) confirmedCount: number;  // 确认份数（受余量约束）
  @Column({ default: '' }) menu: string;

  // 费用规则（夜间加班加餐：企业全额承担，个人不自付；可配置）
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 12 }) price: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) workerSubsidy: number;  // 个人餐补
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 12 }) companySubsidy: number; // 企业补贴
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) selfPay: number;

  @Column({ default: 'draft' }) status: string;
  @Column({ default: false }) highRisk: boolean;       // 是否含高风险作业配送点
  @Column({ type: 'text', nullable: true }) safetyNote: string; // 安全员路线/停留时间确认

  @Column({ nullable: true }) safetyUserId: number;
  @Column({ type: 'timestamptz', nullable: true }) safetyConfirmedAt: Date;
  @Column({ nullable: true }) canteenUserId: number;
  @Column({ type: 'timestamptz', nullable: true }) canteenConfirmedAt: Date;

  @OneToMany(() => ExtraMealPoint, (p) => p.extraMeal) points: ExtraMealPoint[];
  @OneToMany(() => ExtraMealPickup, (p) => p.extraMeal) pickups: ExtraMealPickup[];
  @CreateDateColumn() createdAt: Date;
}
