import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { MealSession } from './meal-session.entity';
import { Team } from './team.entity';
import { User } from './user.entity';

/** 班组长订餐申报：人数 / 工种 / 班次 / 夜宵 / 少数民族餐 / 临时加班 */
@Entity('meal_orders')
@Unique(['sessionId', 'teamId'])
export class MealOrder {
  @PrimaryGeneratedColumn() id: number;

  @Column() sessionId: number;
  @ManyToOne(() => MealSession, (s) => s.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' }) session: MealSession;

  @Column() teamId: number;
  @ManyToOne(() => Team, (t) => t.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' }) team: Team;

  @Column() foremanId: number;
  @ManyToOne(() => User, (u) => u.orders)
  @JoinColumn({ name: 'foremanId' }) foreman: User;

  @Column({ default: 0 }) headcount: number;        // 申报用餐人数
  @Column({ default: '' }) trades: string;          // 工种（钢筋工/混凝土工...）
  @Column({ default: 0 }) nightSnackCount: number;  // 夜宵需求份数
  @Column({ default: 0 }) ethnicCount: number;      // 少数民族餐份数
  @Column({ default: 0 }) overtimeCount: number;    // 临时加班人数
  @Column({ default: '' }) deliveryZone: string;    // 送餐/取餐区域（塔吊作业区等）
  @Column({ type: 'text', nullable: true }) remark: string;

  /** 平台核算后的生成量（依据实名考勤/宿舍人数/施工计划/产能调整） */
  @Column({ default: 0 }) generatedCount: number;
  /** 需求量四来源分解（JSON 字符串，可追溯）：考勤/宿舍/计划/申报/加班/清真/夜宵/合成需求/保底/最终分配 */
  @Column({ type: 'text', nullable: true }) demandDetail: string;
  @Column({ default: 0 }) pickedCount: number;
  @Column({ default: 0 }) wastedCount: number;      // 报损/浪费份数
  @Column({ default: 'draft' }) status: string;     // draft 已申报 / generated 已生成 / adjusted 已调整 / cancelled 已取消
  @CreateDateColumn() createdAt: Date;
}
