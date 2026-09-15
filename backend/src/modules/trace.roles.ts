/**
 * 食品不适追溯：服务端角色权限矩阵（Controller 守卫与 Service 断言共用同一来源）。
 *
 * 角色：ADMIN 平台管理员 / FOREMAN 班组长 / CANTEEN 食堂 / PROJECT 项目部 /
 *       FINANCE 财务 / SAFETY 安全员 / WORKER 工人
 *
 * 职责划分：
 * - 查询（list/detail/dashboard/options）：所有登录角色（含 WORKER 本人查看）；
 * - 建档、个案、名单回访：班组长/食堂/安全员/项目部（事件一线处置方）；
 * - 供应商暂停/恢复、结案：仅项目部与平台管理员；
 * - 留样送检与检测结果：食堂送检登记，安全员/项目部登记结果，财务可登记结果以追责扣款；
 * - 同批食材扫描：安全员/项目部/食堂；
 * - 整改任务：食堂/班组长/安全员/项目部可建可做，验收仅安全员/项目部/管理员。
 */
export const TRACE_ROLES = {
  /** 一线处置角色（建档/个案/通知/回访） */
  FRONTLINE: ['FOREMAN', 'CANTEEN', 'SAFETY', 'PROJECT', 'ADMIN'] as string[],
  /** 供应商处置 / 事件结案（仅项目部 + 管理员） */
  SUPPLIER: ['PROJECT', 'ADMIN'] as string[],
  /** 留样送检出库 */
  SUBMIT_SAMPLE: ['CANTEEN', 'SAFETY', 'PROJECT', 'ADMIN'] as string[],
  /** 登记检测结果（不合格追责时财务参与） */
  LAB_RESULT: ['SAFETY', 'PROJECT', 'FINANCE', 'ADMIN'] as string[],
  /** 同批食材去向扫描/处置 */
  BATCH: ['CANTEEN', 'SAFETY', 'PROJECT', 'ADMIN'] as string[],
  /** 创建整改任务 / 登记整改完成 */
  TASK_WRITE: ['FOREMAN', 'CANTEEN', 'SAFETY', 'PROJECT', 'ADMIN'] as string[],
  /** 整改验收 */
  TASK_VERIFY: ['SAFETY', 'PROJECT', 'ADMIN'] as string[],
} as const;
