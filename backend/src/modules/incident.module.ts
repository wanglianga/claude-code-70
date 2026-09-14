import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from '../entities/incident.entity';
import { IncidentAction } from '../entities/incident-action.entity';
import { MealSession } from '../entities/meal-session.entity';
import { MealOrder } from '../entities/meal-order.entity';
import { Supplier } from '../entities/supplier.entity';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, IncidentAction, MealSession, MealOrder, Supplier])],
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [TypeOrmModule, IncidentService],
})
export class IncidentModule {}
