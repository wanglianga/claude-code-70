import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { TraceService } from './trace.service';
import { TRACE_ROLES as R } from './trace.roles';

/**
 * 食品不适追溯：
 * 多名工人腹痛/呕吐 → 收集个案（取餐时间/菜品/班组/留样编号/就医）→ 同餐次名单回访停餐
 * → 暂停供应商 / 留样送检 / 同批食材去向 → 整改任务 → 结果同步供应商档案 → 结案
 *
 * 服务端角色校验：Controller 守卫做第一道，Service 内按动作类型再断言（验收/供应商等）。
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trace')
export class TraceController {
  constructor(private svc: TraceService) {}

  // 查询：所有登录角色（含 WORKER）
  @Get('options') options() { return this.svc.options(); }
  @Get('dashboard') dashboard() { return this.svc.dashboard(); }
  @Get() list(@Query('status') status?: string) { return this.svc.list(status); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.svc.detail(id); }

  // 建档：一线处置角色
  @Roles(...R.FRONTLINE)
  @Post() create(@Body() dto: any, @Req() req) { return this.svc.create(dto, req.user); }
  @Roles(...R.FRONTLINE)
  @Post(':id/comment') comment(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.comment(id, dto, req.user);
  }

  // 个案不适报告（取餐时间/菜品/班组/留样编号/就医记录）
  @Roles(...R.FRONTLINE)
  @Post(':id/reports') addReport(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.addReport(id, dto, req.user);
  }
  @Roles(...R.FRONTLINE)
  @Post(':id/reports/:rid/medical')
  updateMedical(@Param('id', ParseIntPipe) id: number, @Param('rid', ParseIntPipe) rid: number, @Body() dto: any, @Req() req) {
    return this.svc.updateReportMedical(id, rid, dto, req.user);
  }

  // 同餐次人员名单（取餐流水自动生成）/ 通知 / 回访停餐观察
  @Roles(...R.FRONTLINE)
  @Post(':id/contacts/build') buildContacts(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.svc.buildContacts(id, req.user);
  }
  @Roles(...R.FRONTLINE)
  @Post(':id/contacts/notify') notify(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.notifyContacts(id, dto, req.user);
  }
  @Roles(...R.FRONTLINE)
  @Post(':id/contacts/:cid/followup')
  followUp(@Param('id', ParseIntPipe) id: number, @Param('cid', ParseIntPipe) cid: number, @Body() dto: any, @Req() req) {
    return this.svc.followUp(id, cid, dto, req.user);
  }

  // 项目部：暂停/恢复供应商（仅 PROJECT/ADMIN）
  @Roles(...R.SUPPLIER)
  @Post(':id/supplier/suspend') suspendSupplier(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.suspendSupplier(id, dto, req.user);
  }
  @Roles(...R.SUPPLIER)
  @Post(':id/supplier/resume') resumeSupplier(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.resumeSupplier(id, dto, req.user);
  }

  // 留样送检 + 结果同步供应商档案
  @Roles(...R.SUBMIT_SAMPLE)
  @Post(':id/submissions') submitSample(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.submitSample(id, dto, req.user);
  }
  @Roles(...R.LAB_RESULT)
  @Post(':id/submissions/:sid/result')
  labResult(@Param('id', ParseIntPipe) id: number, @Param('sid', ParseIntPipe) sid: number, @Body() dto: any, @Req() req) {
    return this.svc.recordLabResult(id, sid, dto, req.user);
  }

  // 同批食材是否用于其他餐次（追责范围）
  @Roles(...R.BATCH)
  @Post(':id/batch/scan') scanBatch(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.scanBatch(id, dto, req.user);
  }
  @Roles(...R.BATCH)
  @Post(':id/batch/:bid')
  setBatchUsage(@Param('id', ParseIntPipe) id: number, @Param('bid', ParseIntPipe) bid: number, @Body() dto: any, @Req() req) {
    return this.svc.setBatchUsage(id, bid, dto, req.user);
  }

  // 安全整改任务（创建/完成：一线；验收：SAFETY/PROJECT/ADMIN，Service 内再断言）
  @Roles(...R.TASK_WRITE)
  @Post(':id/tasks') createTask(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.createTask(id, dto, req.user);
  }
  @Roles(...R.TASK_WRITE)
  @Post(':id/tasks/package') taskPackage(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.svc.generateTaskPackage(id, req.user);
  }
  @Roles(...R.TASK_WRITE)
  @Post(':id/tasks/:tid') updateTask(@Param('id', ParseIntPipe) id: number, @Param('tid', ParseIntPipe) tid: number, @Body() dto: any, @Req() req) {
    return this.svc.updateTask(id, tid, dto, req.user);
  }

  // 结案/重开：仅项目部 + 管理员
  @Roles(...R.SUPPLIER)
  @Post(':id/close') close(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req) {
    return this.svc.close(id, dto, req.user);
  }
  @Roles(...R.SUPPLIER)
  @Post(':id/reopen') reopen(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.svc.reopen(id, req.user);
  }
}
