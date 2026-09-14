import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MealService } from './meal.service';

@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealController {
  constructor(private meal: MealService) {}

  // 餐次
  @Get('sessions') listSessions(@Query('date') date?: string) { return this.meal.listSessions(date); }
  @Get('sessions/:id') sessionDetail(@Param('id', ParseIntPipe) id: number) { return this.meal.sessionDetail(id); }
  @Post('sessions') createSession(@Body() dto: any) { return this.meal.createSession(dto); }
  @Post('sessions/:id/status') setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: { status: string }) {
    return this.meal.setSessionStatus(id, dto.status);
  }

  // 班组长订餐
  @Get('orders') listOrders(@Query('sessionId', ParseIntPipe) sessionId: number) { return this.meal.listOrders(sessionId); }
  @Post('orders') submitOrder(@Body() dto: any, @Req() req) { return this.meal.submitOrder(dto, req.user.sub); }
  @Post('sessions/:id/generate') generate(@Param('id', ParseIntPipe) id: number) { return this.meal.generateOrders(id); }

  // 备餐 / 留样 / 配送
  @Get('preparations') listPrep(@Query('sessionId', ParseIntPipe) sessionId: number) { return this.meal.listPreparations(sessionId); }
  @Post('preparations') createPrep(@Body() dto: any) { return this.meal.createPreparation(dto); }
  @Get('samples') listSamples(@Query('status') status?: string) { return this.meal.listSamples(status); }
  @Post('samples') createSample(@Body() dto: any) { return this.meal.createSample(dto); }
  @Post('samples/:id/result') sampleResult(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.meal.setSampleResult(id, dto);
  }
  @Get('deliveries') listDeliveries(@Query('sessionId', ParseIntPipe) sessionId: number) { return this.meal.listDeliveries(sessionId); }
  @Post('deliveries') createDelivery(@Body() dto: any) { return this.meal.createDelivery(dto); }
  @Patch('deliveries/:id') updateDelivery(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.meal.updateDelivery(id, dto);
  }

  // 取餐
  @Post('pickup') pickup(@Body() dto: any) { return this.meal.pickup(dto); }
  @Get('pickups') listPickups(@Query('sessionId') sessionId?: string, @Query('workerId') workerId?: string) {
    return this.meal.listPickups(sessionId ? +sessionId : undefined, workerId ? +workerId : undefined);
  }
}
