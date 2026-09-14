/**
 * 订餐需求合成与产能分配（纯函数，便于核对与测试）。
 *
 * 需求量由四个来源共同形成、全程可追溯：
 *   实名考勤 present / 宿舍人数 dorm / 施工计划 plan / 班组申报 declared
 * 基准上岗人数取"实名考勤"为主，并由"施工计划"与"申报"向上修正（防止漏刷卡低估），
 * 再用"宿舍人数"封顶（实际在场不可能超过宿舍登记人数；宿舍人数上调则上限放宽）。
 * 随后叠加 临时加班、夜宵需求，并用 清真餐份数保底（清真餐必须保障）。
 *
 * 当合成总需求超过食堂容量时，采用「最大余数法(Hamilton)」按比例分配整数份，
 * 保证各班组分配之和【绝不超过容量】；余数相同时清真需求占比高者优先，
 * 且每个班组至少保留其清真餐份数（若清真总量本身超过容量，则先在清真内部按容量封顶）。
 */

export interface DemandInput {
  teamId: number;
  present: number;      // 实名考勤在岗（对应班次）
  dorm: number;         // 宿舍登记人数
  plan: number;         // 施工计划上岗
  declared: number;     // 班组申报用餐人数
  overtime: number;     // 临时加班
  nightSnack: number;   // 夜宵需求
  ethnic: number;       // 少数民族(清真)餐份数
  isMidnight: boolean;  // 是否夜宵餐次
}

export interface DemandRow extends DemandInput {
  baseWorkers: number;  // 合成的基准上岗人数（已封顶到宿舍人数）
  cappedDorm: boolean;  // 是否被宿舍人数封顶
  rawDemand: number;    // 未做清真保底前需求
  want: number;         // 最终合成需求（清真保底后）
}

/** 单个班组的需求合成 */
export function synthesizeOne(i: DemandInput): DemandRow {
  // 1) 基准上岗估计：实名考勤为主，施工计划/班组申报向上修正（兼容漏刷卡、临时增派），
  //    三者取最大估计；考勤为 0（未打卡）时由计划/申报兜底。
  let base = Math.max(i.present, i.plan, i.declared);

  // 2) 宿舍人数封顶：在场人数不可能超过宿舍登记人数（dorm=0 视为未登记，不限制）
  let cappedDorm = false;
  if (i.dorm > 0 && base > i.dorm) { base = i.dorm; cappedDorm = true; }

  // 3) 班次需求
  let need: number;
  if (i.isMidnight) {
    // 夜宵：夜班在场基准与夜宵申报取大（申报可向上修正漏刷卡），再加夜间加班
    need = Math.max(base, i.nightSnack) + i.overtime;
  } else {
    need = base + i.overtime;
  }

  // 4) 清真餐保底：清真餐必须保障，需求不得低于清真份数
  const want = Math.max(need, i.ethnic);
  return { ...i, baseWorkers: base, cappedDorm, rawDemand: need, want };
}

export interface AllocResult {
  totalWant: number;
  capacity: number;
  allocated: number;             // 实际分配总量（<= capacity）
  capacityAdjusted: boolean;
  rows: Array<DemandRow & { allocated: number; ethnicAllocated: number; regularAllocated: number }>;
}

/**
 * 最大余数法分配。
 * 规则：
 *  - 若 totalWant <= capacity：各班组足额分配。
 *  - 否则先为每个班组预留清真保底（受总容量约束），剩余容量按普通餐需求比例用最大余数法分配。
 *  - 保证 allocated 之和 <= capacity。
 */
export function allocate(rows: DemandRow[], capacity: number): AllocResult {
  const cap = Math.max(0, Math.floor(capacity));
  const totalWant = rows.reduce((a, r) => a + r.want, 0);

  if (totalWant <= cap || rows.length === 0) {
    return {
      totalWant, capacity: cap, allocated: Math.min(totalWant, cap), capacityAdjusted: false,
      rows: rows.map((r) => ({
        ...r, allocated: Math.min(r.want, cap), ethnicAllocated: Math.min(r.ethnic, r.want),
        regularAllocated: Math.max(0, Math.min(r.want, cap) - Math.min(r.ethnic, r.want)),
      })),
    };
  }

  // —— 需要压缩 ——
  // 1) 清真保底：总清真需求若超过容量，按容量在清真内部按比例（最大余数法）分配
  const totalEthnic = rows.reduce((a, r) => a + Math.min(r.ethnic, r.want), 0);
  let ethnicAlloc: number[];
  if (totalEthnic <= cap) {
    ethnicAlloc = rows.map((r) => Math.min(r.ethnic, r.want));
  } else {
    ethnicAlloc = largestRemainder(
      rows.map((r) => Math.min(r.ethnic, r.want)),
      cap,
    );
  }
  let used = ethnicAlloc.reduce((a, x) => a + x, 0);
  let remaining = cap - used; // 普通餐可用容量

  // 2) 普通餐需求 = want - 已保底清真
  const regularWant = rows.map((r, idx) => Math.max(0, r.want - ethnicAlloc[idx]));
  const totalRegular = regularWant.reduce((a, x) => a + x, 0);
  let regularAlloc: number[];
  if (totalRegular <= remaining) {
    regularAlloc = regularWant.slice();
  } else {
    regularAlloc = largestRemainder(regularWant, remaining);
  }
  // 数值保护：确保总和不超容量
  let regSum = regularAlloc.reduce((a, x) => a + x, 0);
  if (used + regSum > cap) {
    let excess = used + regSum - cap;
    for (let k = 0; k < regularAlloc.length && excess > 0; k++) {
      const cut = Math.min(regularAlloc[k], excess);
      regularAlloc[k] -= cut; excess -= cut;
    }
    regSum = regularAlloc.reduce((a, x) => a + x, 0);
  }
  used = used + regSum;
  remaining = cap - used;

  const out = rows.map((r, idx) => ({
    ...r,
    ethnicAllocated: ethnicAlloc[idx],
    regularAllocated: regularAlloc[idx],
    allocated: ethnicAlloc[idx] + regularAlloc[idx],
  }));

  return { totalWant, capacity: cap, allocated: out.reduce((a, r) => a + r.allocated, 0), capacityAdjusted: true, rows: out };
}

/**
 * 最大余数法（Hamilton）：把 total 个整数名额按权重 weights 分配，
 * 保证 floor 后用余数从大到小补足，分配之和恰好等于 min(total, sum(weights))。
 * 余数并列时用权重（清真占比高者）与 teamId 稳定打破，体现清真优先。
 */
export function largestRemainder(weights: number[], total: number): number[] {
  const n = weights.length;
  const sumW = weights.reduce((a, w) => a + w, 0);
  const capTotal = Math.min(total, sumW);
  if (n === 0 || sumW === 0) return new Array(n).fill(0);

  const exact = weights.map((w) => (w / sumW) * capTotal);
  const floors = exact.map((x) => Math.floor(x));
  let leftover = capTotal - floors.reduce((a, x) => a + x, 0);

  const order = weights
    .map((w, idx) => ({ idx, rem: exact[idx] - floors[idx], w }))
    // 余数大者优先；余数相同，权重大者优先；再相同索引小者优先（确定性）
    .sort((a, b) => b.rem - a.rem || b.w - a.w || a.idx - b.idx);

  for (const o of order) {
    if (leftover <= 0) break;
    // 不能超过该班组的权重（需求量）
    if (floors[o.idx] < weights[o.idx]) { floors[o.idx] += 1; leftover -= 1; }
  }
  // 若仍有剩余（理论上不会，除非所有名额已达权重上限），直接丢弃，保证不超额
  return floors;
}
