import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { OrgModule } from './modules/org.module';
import { MealModule } from './modules/meal.module';
import { IncidentModule } from './modules/incident.module';
import { StatsModule } from './modules/stats.module';
import { ExtraMealModule } from './modules/extra-meal.module';
import { TraceModule } from './modules/trace.module';
import { HealthController } from './health.controller';
import { SeedService } from './seed/seed.service';
import { User } from './entities/user.entity';
import { Team } from './entities/team.entity';
import { Worker } from './entities/worker.entity';
import { Attendance } from './entities/attendance.entity';
import { ConstructionPlan } from './entities/construction-plan.entity';
import { Canteen } from './entities/canteen.entity';
import { Supplier } from './entities/supplier.entity';
import { MealSession } from './entities/meal-session.entity';
import { MealOrder } from './entities/meal-order.entity';
import { MealPreparation } from './entities/meal-preparation.entity';
import { FoodSample } from './entities/food-sample.entity';
import { MealDelivery } from './entities/meal-delivery.entity';
import { MealPickup } from './entities/meal-pickup.entity';
import { ExtraMeal } from './entities/extra-meal.entity';
import { ExtraMealPoint } from './entities/extra-meal-point.entity';
import { ExtraMealPickup } from './entities/extra-meal-pickup.entity';
import { Incident } from './entities/incident.entity';
import { IncidentAction } from './entities/incident-action.entity';
import { MonthlyArchive } from './entities/monthly-archive.entity';
import { TraceEvent } from './entities/trace-event.entity';
import { DiscomfortReport } from './entities/discomfort-report.entity';
import { ContactPerson } from './entities/contact-person.entity';
import { SampleSubmission } from './entities/sample-submission.entity';
import { BatchUsage } from './entities/batch-usage.entity';
import { RectificationTask } from './entities/rectification-task.entity';
import { TraceAction } from './entities/trace-action.entity';
import { SupplierFoodEvent } from './entities/supplier-food-event.entity';

const entities = [
  User, Team, Worker, Attendance, ConstructionPlan, Canteen, Supplier, MealSession, MealOrder,
  MealPreparation, FoodSample, MealDelivery, MealPickup,
  ExtraMeal, ExtraMealPoint, ExtraMealPickup,
  Incident, IncidentAction, MonthlyArchive,
  TraceEvent, DiscomfortReport, ContactPerson, SampleSubmission, BatchUsage,
  RectificationTask, TraceAction, SupplierFoodEvent,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'db',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'canteen',
      password: process.env.DB_PASSWORD || 'canteen_pwd',
      database: process.env.DB_NAME || 'canteen',
      autoLoadEntities: true,
      synchronize: true,
      retryAttempts: 20,
      retryDelay: 3000,
    }),
    TypeOrmModule.forFeature(entities),
    AuthModule, OrgModule, MealModule, IncidentModule, StatsModule, ExtraMealModule, TraceModule,
  ],
  controllers: [HealthController],
  providers: [SeedService],
})
export class AppModule {}
