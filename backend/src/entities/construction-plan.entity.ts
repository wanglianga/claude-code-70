import {
  Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { Team } from './team.entity';

/**
 * 施工计划：某日期某班次、某班组计划上岗人数（来自项目部施工计划/排班）。
 * 是订餐需求量合成的四个来源之一：实名考勤、宿舍人数、施工计划、班组申报。
 * shift 用 'day' / 'night'，夜宵餐次(midnight)对应 night。
 */
@Entity('construction_plans')
@Unique(['date', 'shift', 'teamId'])
export class ConstructionPlan {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'date' }) date: string;
  @Column({ default: 'day' }) shift: string;

  @Column() teamId: number;
  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' }) team: Team;

  @Column({ default: 0 }) plannedWorkers: number; // 计划上岗人数
  @Column({ default: '' }) workArea: string;     // 计划作业区（3号楼主体 / 塔吊作业区 ...）
  @Column({ default: false }) nightWork: boolean; // 是否夜间施工（夜宵供应依据之一）
  @Column({ type: 'text', nullable: true }) note: string;
}
