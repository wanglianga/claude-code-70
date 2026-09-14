import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from './user.entity';
import { MealPickup } from './meal-pickup.entity';
import { Attendance } from './attendance.entity';

/** 农民工 / 工人档案 */
@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ nullable: true, unique: false }) idCard: string; // 身份证号（未实名可为空）
  @Column({ nullable: true }) faceToken: string;   // 人脸特征标识（演示用）
  @Column({ nullable: true }) pickupCode: string;  // 取餐码（扫码取餐）
  @Column({ default: false }) verified: boolean;   // 是否已实名（人脸+身份证）
  @Column({ default: '汉' }) ethnicity: string;    // 民族（少数民族餐）
  @Column({ default: '普工' }) trade: string;      // 工种
  @Column({ nullable: true }) phone: string;

  @Column() teamId: number;
  @ManyToOne(() => Team, (t) => t.workers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' }) team: Team;

  /** 关联登录账号（工人扫码端，可选） */
  @Column({ nullable: true }) userId: number;
  @ManyToOne(() => User, (u) => u.workers, { nullable: true })
  @JoinColumn({ name: 'userId' }) user: User;

  @OneToMany(() => MealPickup, (p) => p.worker) pickups: MealPickup[];
  @OneToMany(() => Attendance, (a) => a.worker) attendance: Attendance[];
  @CreateDateColumn() createdAt: Date;
}
