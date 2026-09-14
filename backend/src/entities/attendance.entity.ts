import {
  Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { Worker } from './worker.entity';

/** 实名考勤：某工人某日班次是否在岗，作为订餐生成与餐补核算依据 */
@Entity('attendance')
@Unique(['workerId', 'date', 'shift'])
export class Attendance {
  @PrimaryGeneratedColumn() id: number;
  @Column() workerId: number;
  @ManyToOne(() => Worker, (w) => w.attendance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' }) worker: Worker;

  @Column({ type: 'date' }) date: string;
  @Column({ default: 'day' }) shift: string; // day 白班 / night 夜班
  @Column({ default: true }) present: boolean;
  @Column({ default: '' }) location: string;  // 作业区，如 3号楼 / 塔吊作业区
}
