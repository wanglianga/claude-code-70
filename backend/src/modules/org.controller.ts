import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgService } from './org.service';

@UseGuards(JwtAuthGuard)
@Controller('org')
export class OrgController {
  constructor(private org: OrgService) {}

  @Get('teams') listTeams() { return this.org.listTeams(); }
  @Get('teams/:id') teamDetail(@Param('id', ParseIntPipe) id: number) { return this.org.teamDetail(id); }
  @Post('teams') createTeam(@Body() dto: any) { return this.org.createTeam(dto); }

  @Get('workers') listWorkers(@Query('teamId') teamId?: string, @Query('verified') verified?: string) {
    return this.org.listWorkers(teamId ? +teamId : undefined, verified === undefined ? undefined : verified === 'true');
  }
  @Post('workers') createWorker(@Body() dto: any) { return this.org.createWorker(dto); }
  @Post('workers/:id/verify') verify(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.org.verifyWorker(id, dto);
  }
  @Post('workers/:id/transfer') transfer(@Param('id', ParseIntPipe) id: number, @Body() dto: { teamId: number }) {
    return this.org.transferWorker(id, dto.teamId);
  }

  @Get('attendance') listAttendance(@Query('date') date: string, @Query('shift') shift?: string) {
    return this.org.listAttendance(date, shift);
  }
  @Post('attendance') setAttendance(@Body() dto: { date: string; rows: any[] }) {
    return this.org.setAttendance(dto.date, dto.rows);
  }

  @Get('canteens') listCanteens() { return this.org.listCanteens(); }
  @Post('canteens') createCanteen(@Body() dto: any) { return this.org.createCanteen(dto); }
  @Get('suppliers') listSuppliers(@Query('canteenId') canteenId?: string) {
    return this.org.listSuppliers(canteenId ? +canteenId : undefined);
  }
  @Post('suppliers') createSupplier(@Body() dto: any) { return this.org.createSupplier(dto); }
}
