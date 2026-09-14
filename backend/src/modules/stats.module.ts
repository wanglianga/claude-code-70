import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealSession } from '../entities/meal-session.entity';
import { MealOrder } from '../entities/meal-order.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { MealPreparation } from '../entities/meal-preparation.entity';
import { FoodSample } from '../entities/food-sample.entity';
import { Incident } from '../entities/incident.entity';
import { Supplier } from '../entities/supplier.entity';
import { Team } from '../entities/team.entity';
import { MonthlyArchive } from '../entities/monthly-archive.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    MealSession, MealOrder, MealPickup, MealPreparation, FoodSample,
    Incident, Supplier, Team, MonthlyArchive,
  ])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
