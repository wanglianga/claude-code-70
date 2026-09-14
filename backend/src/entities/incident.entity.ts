import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { MealSession } from './meal-session.entity';
import { User } from './user.entity';
import { IncidentAction } from './incident-action.entity';

/**
 * 餐次异常协同：把班组长/食堂/项目部/财务/安全员放在同一餐次里处理。
 * 类型：STOPWORK 临时停工 / TEAM_CHANGE 班组人数变动 / SHORTAGE 菜品不够 /
 *      SPOILED 变质投诉 / NIGHT_ZONE 夜宵送到塔吊区 / SUBSIDY_DISPUTE 补贴争议 /
 *      RECEPTION 项目部临时接待 / WEATHER 高温雨天 / UNVERIFIED 未实名 / CROSS_TEAM 跨班组取餐
 */
@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn() id: number;

  @Column({ nullable: true }) sessionId: number;
  @ManyToOne(() => MealSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sessionId' }) session: MealSession;

  @Column() type: string;
  @Column() title: string;
  @Column({ type: 'text' }) description: string;
  @Column({ default: 'open' }) status: string; // open 处理中 / resolved 已解决 / closed 已关闭
  @Column({ default: '' }) severity: string;   // low / medium / high

  @Column({ nullable: true }) reporterId: number;
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reporterId' }) reporter: User;

  /** 涉及角色（多方协同，逗号分隔）：FOREMAN,CANTEEN,PROJECT,FINANCE,SAFETY */
  @Column({ default: '' }) involvedRoles: string;
  /** 处理结论 / 责任方 / 扣款或调整结果 */
  @Column({ type: 'text', nullable: true }) resolution: string;
  @Column({ nullable: true }) responsibleParty: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) adjustmentAmount: number;

  @OneToMany(() => IncidentAction, (a) => a.incident) actions: IncidentAction[];
  @CreateDateColumn() createdAt: Date;
}
