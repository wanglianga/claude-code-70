import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TraceEvent } from '../entities/trace-event.entity';
import { DiscomfortReport } from '../entities/discomfort-report.entity';
import { ContactPerson } from '../entities/contact-person.entity';
import { SampleSubmission } from '../entities/sample-submission.entity';
import { BatchUsage } from '../entities/batch-usage.entity';
import { RectificationTask } from '../entities/rectification-task.entity';
import { TraceAction } from '../entities/trace-action.entity';
import { Supplier } from '../entities/supplier.entity';
import { SupplierFoodEvent } from '../entities/supplier-food-event.entity';
import { MealSession } from '../entities/meal-session.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { MealPreparation } from '../entities/meal-preparation.entity';
import { FoodSample } from '../entities/food-sample.entity';
import { Worker } from '../entities/worker.entity';
import { Team } from '../entities/team.entity';
import { TraceController } from './trace.controller';
import { TraceService } from './trace.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    TraceEvent, DiscomfortReport, ContactPerson, SampleSubmission, BatchUsage,
    RectificationTask, TraceAction, Supplier, SupplierFoodEvent,
    MealSession, MealPickup, MealPreparation, FoodSample, Worker, Team,
  ])],
  controllers: [TraceController],
  providers: [TraceService],
  exports: [TypeOrmModule, TraceService],
})
export class TraceModule {}
