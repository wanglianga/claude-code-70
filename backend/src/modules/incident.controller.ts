import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { IncidentService } from './incident.service';

@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentController {
  constructor(private svc: IncidentService) {}

  @Get() list(@Query('status') status?: string, @Query('type') type?: string) {
    return this.svc.list(status, type);
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.svc.detail(id); }
  @Post() create(@Body() dto: any, @Req() req) { return this.svc.create(dto, req.user); }
  @Post(':id/actions') action(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.addAction(id, dto, req.user);
  }
  @Post(':id/resolve') resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.svc.resolve(id, dto);
  }
  @Post(':id/reopen') reopen(@Param('id', ParseIntPipe) id: number) { return this.svc.reopen(id); }
}
