import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealSession } from '../entities/meal-session.entity';
import { MealOrder } from '../entities/meal-order.entity';
import { MealPreparation } from '../entities/meal-preparation.entity';
import { FoodSample } from '../entities/food-sample.entity';
import { MealDelivery } from '../entities/meal-delivery.entity';
import { MealPickup } from '../entities/meal-pickup.entity';
import { Worker } from '../entities/worker.entity';
import { Team } from '../entities/team.entity';
import { Canteen } from '../entities/canteen.entity';
import { MealController } from './meal.controller';
import { MealService } from './meal.service';
import { OrgModule } from './org.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MealSession, MealOrder, MealPreparation, FoodSample, MealDelivery, MealPickup,
      Worker, Team, Canteen,
    ]),
    OrgModule,
  ],
  controllers: [MealController],
  providers: [MealService],
  exports: [TypeOrmModule, MealService],
})
export class MealModule {}
