import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtraMeal } from '../entities/extra-meal.entity';
import { ExtraMealPoint } from '../entities/extra-meal-point.entity';
import { ExtraMealPickup } from '../entities/extra-meal-pickup.entity';
import { Canteen } from '../entities/canteen.entity';
import { MealSession } from '../entities/meal-session.entity';
import { Worker } from '../entities/worker.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { ExtraMealController } from './extra-meal.controller';
import { ExtraMealService } from './extra-meal.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    ExtraMeal, ExtraMealPoint, ExtraMealPickup, Canteen, MealSession, Worker, MealPickup,
  ])],
  controllers: [ExtraMealController],
  providers: [ExtraMealService],
})
export class ExtraMealModule {}
