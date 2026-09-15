import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ExtraMealService } from './extra-meal.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('extra-meals')
export class ExtraMealController {
  constructor(private svc: ExtraMealService) {}

  /** 发起前检查（不写库） */
  @Post('precheck')
  precheck(@Body() dto: any) {
    return this.svc.precheck(dto);
  }

  @Get()
  list(@Query('date') date?: string) { return this.svc.list(date); }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) { return this.svc.detail(id); }

  /** 班组长发起加餐 */
  @Post()
  create(@Body() dto: any, @Req() req) { return this.svc.create(dto, req.user); }

  /** 安全员确认高风险路线与停留时间——仅安全员/管理员 */
  @Roles('SAFETY', 'ADMIN')
  @Post(':id/safety')
  safety(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.safetyConfirm(id, dto, req.user);
  }

  /** 食堂确认备餐（扣减食材余量）——仅食堂角色/管理员 */
  @Roles('CANTEEN', 'ADMIN')
  @Post(':id/canteen-confirm')
  canteen(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.svc.canteenConfirm(id, req.user);
  }

  /** 配送出发（登记路线/停留/份数） */
  @Post('points/:pid/depart')
  depart(@Param('pid', ParseIntPipe) pid: number, @Body() dto: any) {
    return this.svc.departPoint(pid, dto);
  }

  /** 施工点签收（签收人/温度/剩余/照片） */
  @Post('points/:pid/receive')
  receive(@Param('pid', ParseIntPipe) pid: number, @Body() dto: any) {
    return this.svc.receivePoint(pid, dto);
  }

  /** 工人领取加餐（费用归入夜宵餐次） */
  @Post('pickup')
  pickup(@Body() dto: any) { return this.svc.pickup(dto); }
}
