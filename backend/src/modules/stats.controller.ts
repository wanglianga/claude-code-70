import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StatsService } from './stats.service';

@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private stats: StatsService) {}

  @Get('dashboard') dashboard(@Query('month') month?: string) { return this.stats.dashboard(month); }
  @Post('settle') settle(@Body() dto: { month: string }) { return this.stats.settle(dto.month); }
  @Get('archives') archives(@Query('month') month?: string) { return this.stats.listArchives(month); }
}
