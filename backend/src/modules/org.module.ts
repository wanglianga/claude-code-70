import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from '../entities/team.entity';
import { Worker } from '../entities/worker.entity';
import { Attendance } from '../entities/attendance.entity';
import { Canteen } from '../entities/canteen.entity';
import { Supplier } from '../entities/supplier.entity';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Worker, Attendance, Canteen, Supplier])],
  controllers: [OrgController],
  providers: [OrgService],
  exports: [TypeOrmModule, OrgService],
})
export class OrgModule {}
