<template>
  <div>
    <div class="page-head">
      <div>
        <h2>食品不适追溯（腹痛/呕吐聚集事件）</h2>
        <div class="sub">多名工人反馈腹痛或呕吐时，收集取餐时间、菜品、班组、留样编号与就医记录；项目部可暂停食材供应商、送检留样、通知同餐次人员停餐观察，并生成安全整改任务；送检结果同步供应商档案，同批食材去向明确追责范围</div>
      </div>
      <el-button v-if="can('create')" type="primary" :icon="Plus" @click="openCreate">新建追溯事件</el-button>
      <el-tag v-else type="info" effect="plain">只读视图（处置操作需班组长/食堂/安全员/项目部权限）</el-tag>
    </div>

    <!-- 看板统计 -->
    <el-row :gutter="12" class="stat-row">
      <el-col :span="3"><el-card class="soft-card stat-card"><div class="num">{{ stat.eventTotal }}</div><div class="lbl">追溯事件</div></el-card></el-col>
      <el-col :span="3"><el-card class="soft-card stat-card"><div class="num" style="color:#c45656">{{ stat.sickWorkerCount || 0 }}</div><div class="lbl">就医/观察人数</div></el-card></el-col>
      <el-col :span="3"><el-card class="soft-card stat-card"><div class="num">{{ stat.reportCount || 0 }}</div><div class="lbl">个案报告</div></el-card></el-col>
      <el-col :span="3"><el-card class="soft-card stat-card"><div class="num" style="color:#e6a23c">{{ stat.observing || 0 }}</div><div class="lbl">停餐观察中</div></el-card></el-col>
      <el-col :span="3"><el-card class="soft-card stat-card"><div class="num" style="color:#409eff">{{ stat.submissionPending || 0 }}</div><div class="lbl">留样送检中</div></el-card></el-col>
      <el-col :span="3"><el-card class="soft-card stat-card"><div class="num" style="color:#c45656">{{ stat.submissionFailed || 0 }}</div><div class="lbl">检测不合格</div></el-card></el-col>
      <el-col :span="3"><el-card class="soft-card stat-card"><div class="num" style="color:#e6a23c">{{ stat.taskOpen || 0 }}</div><div class="lbl">整改待闭环</div></el-card></el-col>
      <el-col :span="3"><el-card class="soft-card stat-card"><div class="num" style="color:#c45656">{{ stat.suspendedSuppliers?.length || 0 }}</div><div class="lbl">暂停中供应商</div></el-card></el-col>
    </el-row>

    <el-row :gutter="14" style="margin-top:14px">
      <!-- 事件列表 -->
      <el-col :span="8">
        <el-card class="soft-card">
          <el-radio-group v-model="filterStatus" size="small" style="margin-bottom:10px" @change="load">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="investigating">调查中</el-radio-button>
            <el-radio-button label="testing">送检中</el-radio-button>
            <el-radio-button label="rectifying">整改中</el-radio-button>
            <el-radio-button label="closed">已结案</el-radio-button>
          </el-radio-group>
          <el-scrollbar height="660px">
            <div v-for="e in list" :key="e.id" class="ev-item" :class="{ active: current?.id === e.id }" @click="select(e.id)">
              <div class="ev-top">
                <el-tag size="small" :type="statusType(e.status)">{{ statusName(e.status) }}</el-tag>
                <el-tag size="small" type="danger" plain v-if="e.supplier?.status === 'suspended'">供应商已暂停</el-tag>
              </div>
              <div class="ev-title">{{ e.title }}</div>
              <div class="ev-code">{{ e.code }}</div>
              <div class="ev-meta">
                {{ e.session ? `${e.session.date} ${shiftName(e.session.shift)}` : '未关联餐次' }}
                <template v-if="e.teamNames"> · {{ e.teamNames }}</template>
              </div>
            </div>
            <el-empty v-if="!list.length" description="暂无追溯事件" />
          </el-scrollbar>
        </el-card>
      </el-col>

      <!-- 事件详情 -->
      <el-col :span="16" v-if="current">
        <el-card class="soft-card">
          <!-- 头部 -->
          <div class="detail-head">
            <div>
              <h3 style="margin:0">
                {{ current.title }}
                <el-tag size="small" :type="statusType(current.status)" style="margin-left:8px">{{ statusName(current.status) }}</el-tag>
                <el-tag size="small" type="danger" effect="plain" style="margin-left:6px" v-if="current.severity === 'high'">紧急</el-tag>
              </h3>
              <div class="muted" style="margin-top:4px">
                {{ current.code }} · 建档人 {{ current.reporter?.name || '—' }} · {{ fmt(current.createdAt) }}
              </div>
            </div>
            <div v-if="can('supplier')">
              <el-button v-if="current.status !== 'closed'" type="danger" plain size="small"
                @click="openSuspend" :disabled="current.supplier?.status === 'suspended'">暂停供应商</el-button>
              <el-button v-if="current.supplier?.status === 'suspended'" type="success" plain size="small" @click="resumeSupplier">恢复供应商</el-button>
              <el-button v-if="current.status !== 'closed'" type="primary" size="small" @click="openClose">结案归档</el-button>
              <el-button v-else size="small" @click="reopen">重新打开</el-button>
            </div>
          </div>

          <el-descriptions :column="3" border size="small" style="margin-top:12px">
            <el-descriptions-item label="关联餐次">
              {{ current.session ? `${current.session.date} ${shiftName(current.session.shift)}` : '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="取餐时间">{{ current.mealTime ? fmt(current.mealTime) : '—' }}</el-descriptions-item>
            <el-descriptions-item label="涉事班组">{{ current.teamNames || '—' }}</el-descriptions-item>
            <el-descriptions-item label="涉事菜品" :span="2">{{ current.dishes || '—' }}</el-descriptions-item>
            <el-descriptions-item label="留样编号">{{ current.sampleBoxNos || '—' }}</el-descriptions-item>
            <el-descriptions-item label="食材批次">{{ current.ingredientBatch || '—' }}</el-descriptions-item>
            <el-descriptions-item label="涉事供应商">
              <span v-if="current.supplier">
                {{ current.supplier.name }}
                <el-tag size="small" :type="current.supplier.status === 'suspended' ? 'danger' : 'success'" style="margin-left:4px">
                  {{ current.supplier.status === 'suspended' ? '已暂停' : '正常' }}
                </el-tag>
              </span>
              <span v-else>—</span>
            </el-descriptions-item>
            <el-descriptions-item label="追责扣款">
              <span class="money-up" v-if="Number(current.penaltyAmount) > 0">¥{{ current.penaltyAmount }}</span>
              <span v-else>—</span>
            </el-descriptions-item>
          </el-descriptions>

          <el-alert :title="current.description" type="error" :closable="false" style="margin:12px 0" show-icon />

          <!-- 处置选项卡 -->
          <el-tabs v-model="tab">
            <!-- 个案报告 -->
            <el-tab-pane :label="`个案报告 (${current.reports?.length || 0})`" name="reports">
              <div style="margin-bottom:10px">
                <el-button v-if="can('create')" type="primary" size="small" :icon="Plus" @click="openReport">登记工人不适/就医</el-button>
                <span class="muted" style="margin-left:10px;font-size:12px">逐人收集取餐时间、菜品、班组、留样编号与就医记录</span>
              </div>
              <el-table :data="current.reports || []" stripe size="small">
                <el-table-column label="工人" min-width="110">
                  <template #default="{ row }">
                    {{ row.workerName }}
                    <el-tag v-if="!row.workerId" size="small" type="info" effect="plain">未实名</el-tag>
                    <div class="muted" style="font-size:12px">{{ row.team?.name || '—' }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="症状" min-width="150">
                  <template #default="{ row }">
                    <el-tag v-for="s in (row.symptoms || '').split(',').filter(Boolean)" :key="s" size="small" type="danger" effect="plain" class="tag-gap">{{ symptomName(s) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="发病/取餐" width="140">
                  <template #default="{ row }">
                    <div>病 {{ fmt(row.onsetAt, true) }}</div>
                    <div class="muted">取 {{ fmt(row.pickupAt, true) }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="菜品/留样" min-width="150">
                  <template #default="{ row }">
                    <div>{{ row.dishes }}</div>
                    <el-tag size="small" type="warning" effect="plain" v-if="row.sampleBoxNo">{{ row.sampleBoxNo }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="就医记录" min-width="180">
                  <template #default="{ row }">
                    <el-tag size="small" :type="medColor(row.medicalStatus)">{{ medName(row.medicalStatus) }}</el-tag>
                    <div v-if="row.hospital" style="font-size:12px;margin-top:2px">{{ row.hospital }}<template v-if="row.diagnosis"> / {{ row.diagnosis }}</template></div>
                    <div v-if="row.medicalNote" class="muted" style="font-size:12px">{{ row.medicalNote }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.status === 'recovered' ? 'success' : row.status === 'following' ? 'warning' : 'info'">
                      {{ ({ reported: '已报告', following: '跟进中', recovered: '已康复', hospitalized: '住院中' })[row.status] || row.status }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="90" fixed="right">
                  <template #default="{ row }">
                    <el-button v-if="can('create')" link type="primary" size="small" @click="openMedical(row)">就医更新</el-button>
                    <span v-else class="muted">—</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 同餐次名单 -->
            <el-tab-pane :label="`同餐次名单 (${current.contacts?.length || 0})`" name="contacts">
              <el-space wrap style="margin-bottom:10px">
                <el-button v-if="can('create')" type="primary" size="small" @click="buildContacts">从取餐流水生成名单</el-button>
                <el-button v-if="can('create')" type="warning" size="small" :disabled="!current.contacts?.length" @click="openNotify">通知并停餐观察</el-button>
                <span v-if="!can('create')" class="muted" style="font-size:12px">同餐次名单只读，通知/停餐观察由班组长/食堂/安全员/项目部执行</span>
              </el-space>
              <el-row :gutter="10" style="margin-bottom:10px">
                <el-col :span="6"><el-alert type="info" :closable="false" :title="`名单 ${current.contacts?.length || 0} 人`" /></el-col>
                <el-col :span="6"><el-alert type="warning" :closable="false" :title="`已通知 ${(current.contacts||[]).filter(c=>c.notifyStatus==='notified').length} 人`" /></el-col>
                <el-col :span="6"><el-alert type="error" :closable="false" :title="`停餐观察 ${(current.contacts||[]).filter(c=>['observing','confirmed_sick'].includes(c.observeStatus)).length} 人`" /></el-col>
                <el-col :span="6"><el-alert type="success" :closable="false" :title="`已回访 ${(current.contacts||[]).filter(c=>c.followedAt).length} 人`" /></el-col>
              </el-row>
              <el-table :data="current.contacts || []" stripe size="small" @selection-change="onContactSelect" ref="contactTable">
                <el-table-column type="selection" width="38" />
                <el-table-column prop="workerName" label="姓名" width="90" />
                <el-table-column label="班组" width="100"><template #default="{ row }">{{ row.team?.name || '—' }}</template></el-table-column>
                <el-table-column prop="phone" label="电话" width="115"><template #default="{ row }">{{ row.phone || '—' }}</template></el-table-column>
                <el-table-column label="取餐" width="120">
                  <template #default="{ row }">
                    {{ row.pickupMethod === 'face' ? '刷脸' : row.pickupMethod === 'code' ? '扫码' : '人工' }}
                    <div class="muted" style="font-size:12px">{{ fmt(row.pickupAt, true) }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="症状" width="70">
                  <template #default="{ row }"><el-tag v-if="row.symptomatic" size="small" type="danger">不适</el-tag><span v-else class="muted">—</span></template>
                </el-table-column>
                <el-table-column label="通知" min-width="130">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.notifyStatus === 'notified' ? 'success' : row.notifyStatus === 'unreachable' ? 'danger' : 'info'">
                      {{ ({ pending: '待通知', notified: '已通知', unreachable: '联系不上' })[row.notifyStatus] }}
                    </el-tag>
                    <div v-if="row.notifyChannel" class="muted" style="font-size:12px">{{ row.notifyChannel }} · {{ fmt(row.notifiedAt, true) }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="停餐观察" min-width="140">
                  <template #default="{ row }">
                    <el-tag size="small" :type="observeColor(row.observeStatus)">{{ observeName(row.observeStatus) }}</el-tag>
                    <div v-if="row.observeUntil" class="muted" style="font-size:12px">至 {{ fmt(row.observeUntil, true) }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="回访结果" min-width="160">
                  <template #default="{ row }">
                    {{ row.followUpResult || '—' }}
                    <div v-if="row.followedAt" class="muted" style="font-size:12px">{{ fmt(row.followedAt, true) }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="80" fixed="right">
                  <template #default="{ row }"><el-button v-if="can('create')" link type="primary" size="small" @click="openFollow(row)">回访</el-button><span v-else class="muted">—</span></template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 留样送检 -->
            <el-tab-pane :label="`留样送检 (${current.submissions?.length || 0})`" name="submissions">
              <el-space wrap style="margin-bottom:10px">
                <el-button v-if="can('submitSample')" type="primary" size="small" :icon="Promotion" @click="openSubmit">送检留样</el-button>
                <span class="muted" style="font-size:12px">送检结果（合格/不合格）自动回写留样并同步供应商食品安全档案；不合格可登记追责扣款</span>
              </el-space>
              <el-table :data="current.submissions || []" stripe size="small">
                <el-table-column label="菜品 / 留样编号" min-width="150">
                  <template #default="{ row }">
                    <b>{{ row.dishName }}</b>
                    <el-tag v-if="row.sampleBoxNo" size="small" type="warning" effect="plain" style="margin-left:6px">{{ row.sampleBoxNo }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="检测机构" min-width="150">
                  <template #default="{ row }">{{ row.labName || '—' }}<div class="muted" style="font-size:12px">{{ row.testItems }}</div></template>
                </el-table-column>
                <el-table-column label="送样" width="140">
                  <template #default="{ row }"><div>{{ fmt(row.sentAt, true) }}</div><div class="muted" style="font-size:12px">{{ row.sentBy }}</div></template>
                </el-table-column>
                <el-table-column label="结果" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" :type="subColor(row.result)">{{ subName(row.result) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="检测报告 / 同步" min-width="200">
                  <template #default="{ row }">
                    <div>{{ row.labReport || '—' }}</div>
                    <el-tag size="small" :type="row.syncedToSupplier ? 'success' : 'info'" effect="plain" style="margin-top:2px">
                      {{ row.syncedToSupplier ? '已同步供应商档案' : '未同步' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-button v-if="can('labResult') && ['pending', 'testing'].includes(row.result)" link type="primary" size="small" @click="openResult(row)">登记结果</el-button>
                    <span v-else class="muted">—</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 同批食材去向 -->
            <el-tab-pane :label="`同批食材去向 (${current.batchUsages?.length || 0})`" name="batch">
              <el-space style="margin-bottom:10px">
                <el-input v-model="batchInput" placeholder="食材批次号，如 BATCH-20260914-A" style="width:260px" />
                <el-button v-if="can('batch')" type="primary" size="small" @click="scanBatch">扫描同批食材用于哪些餐次</el-button>
                <span v-if="!can('batch')" class="muted" style="font-size:12px">同批食材处置由食堂/安全员/项目部执行</span>
              </el-space>
              <el-alert type="info" :closable="false" style="margin-bottom:10px"
                title="留样送检期间，记录同批食材是否已用于其他餐次：已供餐取餐的餐次纳入供应商追责范围与回访名单" />
              <el-table :data="current.batchUsages || []" stripe size="small">
                <el-table-column prop="ingredientBatch" label="批次号" width="160" />
                <el-table-column label="使用餐次" width="130">
                  <template #default="{ row }">{{ row.session ? `${row.session.date} ${shiftName(row.session.shift)}` : '—' }}</template>
                </el-table-column>
                <el-table-column prop="dishName" label="餐食" min-width="180" show-overflow-tooltip />
                <el-table-column prop="usedCount" label="份数" width="70" />
                <el-table-column label="处置" width="90">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.status === 'sealed' ? 'warning' : row.status === 'discarded' ? 'info' : ''">{{ batchStatusName(row.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="追责范围" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.exposed ? 'danger' : 'success'" effect="plain">{{ row.exposed ? '受影响餐次' : '不纳入' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="riskNote" label="风险研判" min-width="200" show-overflow-tooltip />
                <el-table-column label="操作" width="80" fixed="right">
                  <template #default="{ row }"><el-button v-if="can('batch')" link type="primary" size="small" @click="openBatch(row)">处置</el-button><span v-else class="muted">—</span></template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 整改任务 -->
            <el-tab-pane :label="`安全整改 (${current.tasks?.length || 0})`" name="tasks">
              <el-space wrap style="margin-bottom:10px">
                <el-button v-if="can('task')" type="primary" size="small" :icon="MagicStick" @click="taskPackage">一键生成整改任务包</el-button>
                <el-button v-if="can('task')" size="small" :icon="Plus" @click="openTask">新增整改任务</el-button>
                <span v-if="!can('task')" class="muted" style="font-size:12px">整改任务只读，处置需班组长/食堂/安全员/项目部权限</span>
              </el-space>
              <el-table :data="current.tasks || []" stripe size="small">
                <el-table-column label="整改任务" min-width="220">
                  <template #default="{ row }">
                    {{ row.title }}
                    <el-tag size="small" effect="plain" style="margin-left:4px">{{ catName(row.category) }}</el-tag>
                    <div v-if="row.result" class="muted" style="font-size:12px">{{ row.result }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="责任人" width="110"><template #default="{ row }">{{ row.assigneeName || row.assignee?.name || '待派单' }}</template></el-table-column>
                <el-table-column label="限期" width="130"><template #default="{ row }">{{ fmt(row.dueAt, true) }}</template></el-table-column>
                <el-table-column label="状态" width="100">
                  <template #default="{ row }"><el-tag size="small" :type="taskColor(row.status)">{{ taskName(row.status) }}</el-tag></template>
                </el-table-column>
                <el-table-column label="操作" width="150" fixed="right">
                  <template #default="{ row }">
                    <el-button v-if="can('task') && row.status === 'open'" link type="primary" size="small" @click="finishTask(row)">完成</el-button>
                    <el-button v-if="can('taskVerify') && row.status === 'done'" link type="success" size="small" @click="verifyTask(row)">验收</el-button>
                    <el-button v-if="can('task')" link size="small" @click="openTask(row)">编辑</el-button>
                    <span v-if="!can('task')" class="muted">—</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 供应商档案 + 处置时间线 -->
            <el-tab-pane label="供应商档案 / 时间线" name="timeline">
              <el-card v-if="supplierProfile" shadow="never" style="background:#fafbfa;margin-bottom:14px">
                <div class="section-title">
                  {{ supplierProfile.name }} 食品安全档案
                  <el-tag size="small" :type="supplierProfile.status === 'suspended' ? 'danger' : 'success'">
                    {{ supplierProfile.status === 'suspended' ? '暂停供料中' : '供料正常' }}
                  </el-tag>
                  <span class="muted" style="font-weight:400;font-size:12px">许可证 {{ supplierProfile.licenseNo }} · 累计扣款 ¥{{ supplierProfile.deduction }}</span>
                </div>
                <el-timeline>
                  <el-timeline-item v-for="fe in (supplierProfile.foodEvents || [])" :key="fe.id" :timestamp="fmt(fe.createdAt)"
                    :type="fe.type.includes('fail') || fe.type === 'penalty' || fe.type === 'suspension' ? 'danger' : fe.type === 'resume' ? 'success' : 'primary'">
                    <el-tag size="small" :type="feName(fe.type).type">{{ feName(fe.type).label }}</el-tag>
                    <b style="margin-left:6px">{{ fe.title }}</b>
                    <div v-if="fe.content" class="muted" style="font-size:13px">{{ fe.content }}</div>
                  </el-timeline-item>
                  <el-empty v-if="!(supplierProfile.foodEvents || []).length" :description="'暂无食安档案记录'" :image-size="60" />
                </el-timeline>
              </el-card>

              <div class="section-title">处置时间线</div>
              <el-timeline>
                <el-timeline-item v-for="a in (current.actions || []).slice().sort((x,y)=>x.id-y.id).reverse()" :key="a.id" :timestamp="fmt(a.createdAt)"
                  :type="roleColor(a.actorRole)" placement="top">
                  <el-tag size="small" :type="roleColor(a.actorRole)">{{ roleShort(a.actorRole) }}</el-tag>
                  <el-tag size="small" effect="plain" style="margin-left:6px">{{ actionName(a.action) }}</el-tag>
                  <span style="margin-left:8px">{{ a.content }}</span>
                </el-timeline-item>
              </el-timeline>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
      <el-col :span="16" v-else><el-card class="soft-card"><el-empty description="请选择左侧追溯事件，或新建一起食品不适事件" /></el-card></el-col>
    </el-row>

    <!-- 新建事件 -->
    <el-dialog v-model="createVisible" title="新建食品不适追溯事件" width="620px">
      <el-form :model="form" label-width="92px">
        <el-form-item label="标题" required><el-input v-model="form.title" placeholder="如：午餐后多名工人腹痛呕吐" /></el-form-item>
        <el-form-item label="关联餐次">
          <el-select v-model="form.sessionId" clearable filterable style="width:100%" placeholder="选择涉事餐次（自动带出供应商/食材批次）">
            <el-option v-for="s in sessions" :key="s.id" :label="`${s.date} ${shiftName(s.shift)}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="取餐时间"><el-date-picker v-model="form.mealTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" /></el-form-item>
        <el-form-item label="涉事菜品"><el-input v-model="form.dishes" placeholder="多个菜品用顿号/逗号分隔" /></el-form-item>
        <el-form-item label="留样编号"><el-input v-model="form.sampleBoxNos" placeholder="如 BOX-红烧、BOX-番茄" /></el-form-item>
        <el-form-item label="涉事供应商">
          <el-select v-model="form.supplierId" clearable filterable style="width:100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="食材批次"><el-input v-model="form.ingredientBatch" placeholder="如 BATCH-20260914-A" /></el-form-item>
        <el-form-item label="严重程度">
          <el-radio-group v-model="form.severity">
            <el-radio label="low">一般</el-radio><el-radio label="medium">较重</el-radio><el-radio label="high">紧急</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="情况描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">建档并启动追溯</el-button>
      </template>
    </el-dialog>

    <!-- 个案报告 -->
    <el-dialog v-model="reportVisible" title="登记工人不适 / 就医记录" width="640px">
      <el-form :model="rform" label-width="92px">
        <el-form-item label="工人">
          <el-select v-model="rform.workerId" clearable filterable style="width:100%" placeholder="实名工人（也可留空直接填姓名）" @change="onPickWorker">
            <el-option v-for="w in workers" :key="w.id" :label="`${w.name}（${w.team?.name || '未分班'}${w.verified ? '' : '·未实名'}）`" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!rform.workerId" label="姓名" required><el-input v-model="rform.workerName" /></el-form-item>
        <el-form-item label="症状" required>
          <el-checkbox-group v-model="rform.symptoms">
            <el-checkbox v-for="o in options.symptoms || []" :key="o.value" :label="o.value">{{ o.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="发病时间"><el-date-picker v-model="rform.onsetAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" /></el-form-item>
        <el-form-item label="取餐时间"><el-date-picker v-model="rform.pickupAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" /></el-form-item>
        <el-form-item label="食用菜品"><el-input v-model="rform.dishes" /></el-form-item>
        <el-form-item label="留样编号"><el-input v-model="rform.sampleBoxNo" placeholder="如 BOX-红烧" /></el-form-item>
        <el-form-item label="就医情况">
          <el-select v-model="rform.medicalStatus" style="width:100%">
            <el-option v-for="o in options.medical || []" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <template v-if="rform.medicalStatus !== 'none'">
          <el-form-item label="就诊机构"><el-input v-model="rform.hospital" /></el-form-item>
          <el-form-item label="诊断结果"><el-input v-model="rform.diagnosis" /></el-form-item>
          <el-form-item label="就医备注"><el-input v-model="rform.medicalNote" type="textarea" :rows="2" /></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="reportVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReport">保存个案</el-button>
      </template>
    </el-dialog>

    <!-- 就医更新 -->
    <el-dialog v-model="medVisible" title="更新就医记录" width="520px">
      <el-form :model="medForm" label-width="92px">
        <el-form-item label="工人"><b>{{ medForm.workerName }}</b></el-form-item>
        <el-form-item label="就医情况">
          <el-select v-model="medForm.medicalStatus" style="width:100%">
            <el-option v-for="o in options.medical || []" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="就诊机构"><el-input v-model="medForm.hospital" /></el-form-item>
        <el-form-item label="诊断结果"><el-input v-model="medForm.diagnosis" /></el-form-item>
        <el-form-item label="个案状态">
          <el-radio-group v-model="medForm.status">
            <el-radio label="reported">已报告</el-radio><el-radio label="following">跟进中</el-radio><el-radio label="recovered">已康复</el-radio><el-radio label="hospitalized">住院中</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="medVisible=false">取消</el-button><el-button type="primary" @click="submitMedical">保存</el-button></template>
    </el-dialog>

    <!-- 通知/停餐 -->
    <el-dialog v-model="notifyVisible" title="通知同餐次人员 · 停餐观察" width="520px">
      <el-alert type="warning" :closable="false" style="margin-bottom:12px"
        :title="`将通知 ${selectedContacts.length ? `选中的 ${selectedContacts.length} 人` : `全部 ${current?.contacts?.length || 0} 人`}`" />
      <el-form label-width="110px">
        <el-form-item label="通知方式"><el-input v-model="nform.channel" placeholder="电话+班组长转达" /></el-form-item>
        <el-form-item label="停餐观察">
          <el-switch v-model="nform.suspendMeal" active-text="同时下发停餐观察" />
        </el-form-item>
        <el-form-item v-if="nform.suspendMeal" label="观察时长(小时)">
          <el-input-number v-model="nform.observeHours" :min="6" :max="120" :step="6" />
        </el-form-item>
        <el-form-item label="通知内容"><el-input v-model="nform.content" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="notifyVisible=false">取消</el-button><el-button type="warning" @click="submitNotify">发送通知</el-button></template>
    </el-dialog>

    <!-- 回访 -->
    <el-dialog v-model="followVisible" title="同餐次人员回访" width="520px">
      <el-form label-width="92px">
        <el-form-item label="人员"><b>{{ followRow?.workerName }}</b>（{{ followRow?.team?.name }}）</el-form-item>
        <el-form-item label="观察状态">
          <el-select v-model="fform.observeStatus" style="width:100%">
            <el-option label="停餐观察中" value="observing" />
            <el-option label="确认发病就医" value="confirmed_sick" />
            <el-option label="已恢复供餐" value="resumed" />
            <el-option label="无需观察" value="none" />
          </el-select>
        </el-form-item>
        <el-form-item label="回访结果"><el-input v-model="fform.followUpResult" type="textarea" :rows="3" placeholder="如：无症状 / 轻微腹泻已缓解 / 已送医" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="followVisible=false">取消</el-button><el-button type="primary" @click="submitFollow">保存回访</el-button></template>
    </el-dialog>

    <!-- 暂停供应商 -->
    <el-dialog v-model="suspendVisible" title="暂停食材供应商供料" width="520px">
      <el-form label-width="92px">
        <el-form-item label="供应商">
          <el-select v-model="sform.supplierId" filterable style="width:100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="暂停原因"><el-input v-model="sform.reason" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="suspendVisible=false">取消</el-button><el-button type="danger" @click="submitSuspend">确认暂停并记入档案</el-button></template>
    </el-dialog>

    <!-- 送检 -->
    <el-dialog v-model="submitVisible" title="留样送第三方检测" width="560px">
      <el-form label-width="92px">
        <el-form-item label="选择留样">
          <el-select v-model="pform.sampleId" clearable filterable style="width:100%" placeholder="选择 48h 留样（也可留空手填菜品）">
            <el-option v-for="s in retainedSamples" :key="s.id"
              :label="`${s.dishName}（${s.boxNo || '无盒号'}）· ${s.preparation?.session?.date || ''} · ${({retained:'留样中',testing:'送检中'})[s.status]}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!pform.sampleId" label="送检菜品" required><el-input v-model="pform.dishName" /></el-form-item>
        <el-form-item label="检测机构"><el-input v-model="pform.labName" placeholder="如 市食品检验检测中心" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="pform.labContact" /></el-form-item>
        <el-form-item label="检测项目">
          <el-checkbox-group v-model="pform.testItems">
            <el-checkbox v-for="t in (options.testItems || [])" :key="t" :label="t">{{ t }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="submitVisible=false">取消</el-button><el-button type="primary" @click="submitSubmit">送检出库</el-button></template>
    </el-dialog>

    <!-- 检测结果 -->
    <el-dialog v-model="resultVisible" title="登记留样检测结果" width="560px">
      <el-form label-width="92px">
        <el-form-item label="样品"><b>{{ resultRow?.dishName }}</b>（{{ resultRow?.sampleBoxNo }}）</el-form-item>
        <el-form-item label="检测结果">
          <el-radio-group v-model="resform.result">
            <el-radio label="passed">合格</el-radio>
            <el-radio label="failed">不合格</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="检测报告"><el-input v-model="resform.labReport" type="textarea" :rows="3" placeholder="如 菌落总数 8.2×10⁵ CFU/g，检出沙门氏菌" /></el-form-item>
        <el-form-item v-if="resform.result === 'failed'" label="追责扣款(元)">
          <el-input-number v-model="resform.penaltyAmount" :min="0" :precision="2" :step="100" />
          <span class="muted" style="margin-left:8px">不合格结果与扣款同步供应商档案</span>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="resultVisible=false">取消</el-button><el-button :type="resform.result==='failed'?'danger':'primary'" @click="submitResult">保存并同步档案</el-button></template>
    </el-dialog>

    <!-- 同批处置 -->
    <el-dialog v-model="batchVisible" title="同批食材餐次处置" width="520px">
      <el-form label-width="92px">
        <el-form-item label="餐次"><b>{{ batchRow?.session ? `${batchRow.session.date} ${shiftName(batchRow.session.shift)}` : '—' }}</b> · {{ batchRow?.dishName }}</el-form-item>
        <el-form-item label="处置状态">
          <el-radio-group v-model="bform.status">
            <el-radio label="used">已使用</el-radio><el-radio label="sealed">已封存</el-radio><el-radio label="discarded">已销毁</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="追责范围"><el-switch v-model="bform.exposed" active-text="认定为受影响餐次（纳入供应商追责）" /></el-form-item>
        <el-form-item label="风险研判"><el-input v-model="bform.riskNote" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="batchVisible=false">取消</el-button><el-button type="primary" @click="submitBatch">保存</el-button></template>
    </el-dialog>

    <!-- 整改任务 -->
    <el-dialog v-model="taskVisible" :title="taskForm.id ? '编辑整改任务' : '新增整改任务'" width="540px">
      <el-form label-width="92px">
        <el-form-item label="任务标题" required><el-input v-model="taskForm.title" /></el-form-item>
        <el-form-item label="类别">
          <el-select v-model="taskForm.category" style="width:100%">
            <el-option v-for="(n,k) in CATS" :key="k" :label="n" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="责任人"><el-input v-model="taskForm.assigneeName" placeholder="如 周师傅 / 食堂 / 项目部" /></el-form-item>
        <el-form-item label="限期完成"><el-date-picker v-model="taskForm.dueAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" /></el-form-item>
        <el-form-item label="任务说明"><el-input v-model="taskForm.detail" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="taskVisible=false">取消</el-button><el-button type="primary" @click="submitTask">保存</el-button></template>
    </el-dialog>

    <!-- 结案 -->
    <el-dialog v-model="closeVisible" title="事件结案归档" width="560px">
      <el-form label-width="92px">
        <el-form-item label="责任方"><el-input v-model="cform.responsibleParty" /></el-form-item>
        <el-form-item label="结案结论" required><el-input v-model="cform.conclusion" type="textarea" :rows="4" placeholder="检测结论、医疗救治、供应商追责、整改闭环情况" /></el-form-item>
        <el-form-item v-if="current?.supplier?.status === 'suspended'" label="供应商">
          <el-switch v-model="cform.resumeSupplier" active-text="结案同时恢复供应商供料" />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="closeVisible=false">取消</el-button><el-button type="primary" @click="submitClose">确认结案</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Promotion, MagicStick } from '@element-plus/icons-vue';
import api from '../api';
import { useAuthStore } from '../store';

const auth = useAuthStore();
/** 服务端角色矩阵与后端 trace.roles.ts 保持一致（前端仅控制显隐，真正校验在服务端） */
const CAN = {
  create: ['FOREMAN', 'CANTEEN', 'SAFETY', 'PROJECT', 'ADMIN'],
  supplier: ['PROJECT', 'ADMIN'],                 // 暂停/恢复供应商、结案
  submitSample: ['CANTEEN', 'SAFETY', 'PROJECT', 'ADMIN'],
  labResult: ['SAFETY', 'PROJECT', 'FINANCE', 'ADMIN'],
  batch: ['CANTEEN', 'SAFETY', 'PROJECT', 'ADMIN'],
  task: ['FOREMAN', 'CANTEEN', 'SAFETY', 'PROJECT', 'ADMIN'],
  taskVerify: ['SAFETY', 'PROJECT', 'ADMIN'],
};
const can = (k) => CAN[k].includes(auth.role);
const readOnly = computed(() => !can('create'));

const SHIFTS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', midnight: '夜宵' };
const CATS = { seal: '封存食材', recall: '同批追回', disinfect: '环境消毒', supplier: '供应商整改', retrain: '人员培训', other: '其他' };
const shiftName = (s) => SHIFTS[s] || s;

const statusName = (s) => ({ investigating: '调查中', testing: '留样送检中', rectifying: '整改中', closed: '已结案' })[s] || s;
const statusType = (s) => ({ investigating: 'warning', testing: 'primary', rectifying: 'danger', closed: 'success' })[s] || '';
const symptomName = (s) => (SYM[s] || s);
const SYM = { abdominal_pain: '腹痛', vomiting: '呕吐', diarrhea: '腹泻', fever: '发热', nausea: '恶心', dizziness: '头晕' };
const MED = { none: '未就医', outpatient: '门诊', inpatient: '住院', observation: '现场观察' };
const medName = (m) => MED[m] || m;
const medColor = (m) => ({ none: 'info', outpatient: 'warning', inpatient: 'danger', observation: 'warning' })[m] || '';
const subName = (r) => ({ pending: '待送检', testing: '检测中', passed: '合格', failed: '不合格' })[r] || r;
const subColor = (r) => ({ pending: 'info', testing: 'primary', passed: 'success', failed: 'danger' })[r] || '';
const observeName = (s) => ({ none: '—', observing: '停餐观察中', resumed: '已恢复供餐', confirmed_sick: '确认发病' })[s] || s;
const observeColor = (s) => ({ none: 'info', observing: 'warning', resumed: 'success', confirmed_sick: 'danger' })[s] || '';
const batchStatusName = (s) => ({ used: '已使用', sealed: '已封存', discarded: '已销毁' })[s] || s;
const catName = (c) => CATS[c] || c;
const taskName = (s) => ({ open: '待整改', done: '待验收', verified: '已验收', overdue: '逾期' })[s] || s;
const taskColor = (s) => ({ open: 'warning', done: 'primary', verified: 'success', overdue: 'danger' })[s] || '';
const roleShort = (r) => ({ FOREMAN: '班组长', CANTEEN: '食堂', PROJECT: '项目部', FINANCE: '财务', SAFETY: '安全员', ADMIN: '管理员', WORKER: '工人' })[r] || r;
const roleColor = (r) => ({ FOREMAN: 'primary', CANTEEN: 'warning', PROJECT: 'success', FINANCE: 'info', SAFETY: 'danger', ADMIN: 'danger' })[r] || '';
const ACTIONS = {
  create: '建档', report: '个案报告', notify: '通知名单', observe: '回访停餐', suspend_supplier: '暂停供应商',
  resume_supplier: '恢复供应商', submit_sample: '留样送检', lab_result: '检测结果', batch_scan: '同批追踪',
  task_create: '整改任务', task_done: '整改完成', task_verify: '整改验收', close: '结案', comment: '意见',
};
const actionName = (a) => ACTIONS[a] || a;
const feName = (t) => ({
  lab_pass: { label: '检测合格', type: 'success' }, lab_fail: { label: '检测不合格', type: 'danger' },
  suspension: { label: '暂停供料', type: 'danger' }, resume: { label: '恢复供料', type: 'success' },
  penalty: { label: '追责扣款', type: 'danger' },
}[t] || { label: t, type: 'info' });
function fmt(t, short) {
  if (!t) return '—';
  const d = new Date(t);
  if (short) return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toLocaleString('zh-CN', { hour12: false });
}

const list = ref([]);
const stat = ref({});
const current = ref(null);
const filterStatus = ref('');
const tab = ref('reports');
const sessions = ref([]);
const suppliers = ref([]);
const workers = ref([]);
const options = ref({});
const allSamples = ref([]);

const supplierProfile = computed(() => {
  const id = current.value?.supplierId;
  return suppliers.value.find((s) => s.id === id) || null;
});
/** 送检留样下拉：仅当前事件餐次的在库/送检中留样 */
const retainedSamples = computed(() => allSamples.value.filter(
  (s) => s.preparation?.sessionId === current.value?.sessionId && ['retained', 'testing'].includes(s.status),
));

async function load() {
  const [events, dash, sess, sups, wks, opts, smps] = await Promise.all([
    api.get('/trace', { params: filterStatus.value ? { status: filterStatus.value } : {} }),
    api.get('/trace/dashboard'),
    api.get('/meals/sessions'),
    api.get('/org/suppliers'),
    api.get('/org/workers'),
    api.get('/trace/options'),
    api.get('/meals/samples'),
  ]);
  list.value = events;
  stat.value = dash;
  sessions.value = sess;
  suppliers.value = sups;
  workers.value = wks;
  options.value = opts;
  allSamples.value = smps;
  if (current.value) current.value = await api.get(`/trace/${current.value.id}`);
}
async function select(id) { current.value = await api.get(`/trace/${id}`); tab.value = 'reports'; }

// ---- 新建事件 ----
const createVisible = ref(false);
const form = reactive({ title: '', description: '', sessionId: null, mealTime: '', dishes: '', sampleBoxNos: '', supplierId: null, ingredientBatch: '', severity: 'high' });
function openCreate() {
  Object.assign(form, { title: '', description: '', sessionId: sessions.value[0]?.id || null, mealTime: '', dishes: '', sampleBoxNos: '', supplierId: null, ingredientBatch: '', severity: 'high' });
  createVisible.value = true;
}
async function submitCreate() {
  if (!form.title) return ElMessage.warning('请填写标题');
  const ev = await api.post('/trace', form);
  ElMessage.success('追溯事件已建档');
  createVisible.value = false;
  current.value = ev;
  tab.value = 'reports';
  await load();
}

// ---- 个案 ----
const reportVisible = ref(false);
const rform = reactive({ workerId: null, workerName: '', symptoms: [], onsetAt: '', pickupAt: '', dishes: '', sampleBoxNo: '', medicalStatus: 'none', hospital: '', diagnosis: '', medicalNote: '' });
function openReport() {
  Object.assign(rform, { workerId: null, workerName: '', symptoms: ['abdominal_pain'], onsetAt: '', pickupAt: current.value.mealTime ? new Date(current.value.mealTime).toISOString().slice(0, 19) : '', dishes: current.value.dishes || '', sampleBoxNo: '', medicalStatus: 'none', hospital: '', diagnosis: '', medicalNote: '' });
  reportVisible.value = true;
}
function onPickWorker(id) {
  const w = workers.value.find((x) => x.id === id);
  rform.workerName = w?.name || '';
}
async function submitReport() {
  if (!rform.workerId && !rform.workerName) return ElMessage.warning('请选择工人或填写姓名');
  if (!rform.symptoms.length) return ElMessage.warning('请勾选症状');
  const res = await api.post(`/trace/${current.value.id}/reports`, rform);
  current.value = res.event;
  ElMessage.success('个案已登记');
  reportVisible.value = false;
  await load();
}

const medVisible = ref(false);
const medForm = reactive({ id: null, workerName: '', medicalStatus: 'none', hospital: '', diagnosis: '', status: 'reported' });
function openMedical(row) {
  Object.assign(medForm, { id: row.id, workerName: row.workerName, medicalStatus: row.medicalStatus, hospital: row.hospital || '', diagnosis: row.diagnosis || '', status: row.status });
  medVisible.value = true;
}
async function submitMedical() {
  current.value = await api.post(`/trace/${current.value.id}/reports/${medForm.id}/medical`, { ...medForm });
  medVisible.value = false;
  ElMessage.success('就医记录已更新');
  await load();
}

// ---- 名单 / 通知 / 回访 ----
const contactTable = ref();
const selectedContacts = ref([]);
function onContactSelect(rows) { selectedContacts.value = rows; }
async function buildContacts() {
  current.value = await api.post(`/trace/${current.value.id}/contacts/build`);
  ElMessage.success('已按取餐流水生成同餐次人员名单');
  await load();
}
const notifyVisible = ref(false);
const nform = reactive({ channel: '电话+班组长转达', suspendMeal: true, observeHours: 48, content: '请留意腹痛、呕吐、腹泻等症状，暂停食堂供餐观察，如有不适立即就医并联系班组长。' });
function openNotify() { notifyVisible.value = true; }
async function submitNotify() {
  current.value = await api.post(`/trace/${current.value.id}/contacts/notify`, {
    ids: selectedContacts.value.map((c) => c.id),
    channel: nform.channel, suspendMeal: nform.suspendMeal, observeHours: nform.observeHours, content: nform.content,
  });
  notifyVisible.value = false;
  ElMessage.success('已通知并登记停餐观察');
  await load();
}
const followVisible = ref(false);
const followRow = ref(null);
const fform = reactive({ observeStatus: 'observing', followUpResult: '' });
function openFollow(row) {
  followRow.value = row;
  fform.observeStatus = row.observeStatus === 'none' ? 'observing' : row.observeStatus;
  fform.followUpResult = row.followUpResult || '';
  followVisible.value = true;
}
async function submitFollow() {
  current.value = await api.post(`/trace/${current.value.id}/contacts/${followRow.value.id}/followup`, { ...fform });
  followVisible.value = false;
  ElMessage.success('回访结果已登记');
  await load();
}

// ---- 供应商 ----
const suspendVisible = ref(false);
const sform = reactive({ supplierId: null, reason: '' });
function openSuspend() {
  sform.supplierId = current.value.supplierId || suppliers.value[0]?.id || null;
  sform.reason = '多名工人餐后腹痛呕吐，疑似食材污染，留样送检与调查期间暂停供料';
  suspendVisible.value = true;
}
async function submitSuspend() {
  if (!sform.supplierId) return ElMessage.warning('请选择供应商');
  current.value = await api.post(`/trace/${current.value.id}/supplier/suspend`, { ...sform });
  suspendVisible.value = false;
  ElMessage.success('供应商已暂停并记入食安档案');
  await load();
}
async function resumeSupplier() {
  current.value = await api.post(`/trace/${current.value.id}/supplier/resume`, {});
  ElMessage.success('供应商已恢复供料');
  await load();
}

// ---- 送检 ----
const submitVisible = ref(false);
const pform = reactive({ sampleId: null, dishName: '', labName: '市食品检验检测中心', labContact: '', testItems: ['菌落总数', '大肠菌群'] });
function openSubmit() {
  Object.assign(pform, { sampleId: null, dishName: '', labName: '市食品检验检测中心', labContact: '', testItems: ['菌落总数', '大肠菌群'] });
  submitVisible.value = true;
}
async function submitSubmit() {
  if (!pform.sampleId && !pform.dishName) return ElMessage.warning('请选择留样或填写菜品');
  current.value = await api.post(`/trace/${current.value.id}/submissions`, { ...pform });
  submitVisible.value = false;
  ElMessage.success('留样已送检出库，留样状态变更为送检中');
  await load();
}
const resultVisible = ref(false);
const resultRow = ref(null);
const resform = reactive({ result: 'failed', labReport: '', penaltyAmount: 0 });
function openResult(row) {
  resultRow.value = row;
  resform.result = 'failed'; resform.labReport = ''; resform.penaltyAmount = 0;
  resultVisible.value = true;
}
async function submitResult() {
  current.value = await api.post(`/trace/${current.value.id}/submissions/${resultRow.value.id}/result`, { ...resform });
  resultVisible.value = false;
  ElMessage.success('检测结果已登记并同步供应商档案');
  await load();
}

// ---- 同批 ----
const batchInput = ref('');
async function scanBatch() {
  const batch = batchInput.value || current.value.ingredientBatch;
  if (!batch) return ElMessage.warning('请输入食材批次号');
  current.value = await api.post(`/trace/${current.value.id}/batch/scan`, { ingredientBatch: batch });
  ElMessage.success('已扫描同批食材去向');
  await load();
}
const batchVisible = ref(false);
const batchRow = ref(null);
const bform = reactive({ status: 'used', exposed: false, riskNote: '' });
function openBatch(row) {
  batchRow.value = row;
  bform.status = row.status; bform.exposed = row.exposed; bform.riskNote = row.riskNote || '';
  batchVisible.value = true;
}
async function submitBatch() {
  current.value = await api.post(`/trace/${current.value.id}/batch/${batchRow.value.id}`, { ...bform });
  batchVisible.value = false;
  ElMessage.success('同批去向已更新');
  await load();
}

// ---- 整改任务 ----
async function taskPackage() {
  current.value = await api.post(`/trace/${current.value.id}/tasks/package`);
  ElMessage.success('已生成标准整改任务包');
  tab.value = 'tasks';
  await load();
}
const taskVisible = ref(false);
const taskForm = reactive({ id: null, title: '', category: 'other', assigneeName: '', dueAt: '', detail: '' });
function openTask(row) {
  if (row) Object.assign(taskForm, { id: row.id, title: row.title, category: row.category, assigneeName: row.assigneeName || '', dueAt: row.dueAt ? new Date(row.dueAt).toISOString().slice(0, 19) : '', detail: row.detail || '' });
  else Object.assign(taskForm, { id: null, title: '', category: 'other', assigneeName: '', dueAt: '', detail: '' });
  taskVisible.value = true;
}
async function submitTask() {
  if (!taskForm.title) return ElMessage.warning('请填写任务标题');
  if (taskForm.id) current.value = await api.post(`/trace/${current.value.id}/tasks/${taskForm.id}`, { ...taskForm });
  else current.value = await api.post(`/trace/${current.value.id}/tasks`, { ...taskForm });
  taskVisible.value = false;
  ElMessage.success('整改任务已保存');
  await load();
}
async function finishTask(row) {
  const { value } = await ElMessageBox.prompt('整改完成情况说明', `完成：${row.title}`, { inputValue: row.result || '', confirmButtonText: '提交完成' }).catch(() => ({ value: null }));
  if (value === null) return;
  current.value = await api.post(`/trace/${current.value.id}/tasks/${row.id}`, { status: 'done', result: value });
  await load();
}
async function verifyTask(row) {
  current.value = await api.post(`/trace/${current.value.id}/tasks/${row.id}`, { status: 'verified' });
  ElMessage.success('整改已验收');
  await load();
}

// ---- 结案 ----
const closeVisible = ref(false);
const cform = reactive({ conclusion: '', responsibleParty: '', resumeSupplier: false });
function openClose() {
  cform.conclusion = ''; cform.responsibleParty = current.value.responsibleParty || current.value.supplier?.name || ''; cform.resumeSupplier = false;
  closeVisible.value = true;
}
async function submitClose() {
  if (!cform.conclusion) return ElMessage.warning('请填写结案结论');
  current.value = await api.post(`/trace/${current.value.id}/close`, { ...cform });
  closeVisible.value = false;
  ElMessage.success('事件已结案归档');
  await load();
}
async function reopen() {
  current.value = await api.post(`/trace/${current.value.id}/reopen`);
  await load();
}

onMounted(load);
</script>

<style scoped>
.stat-row .el-card { padding: 4px 10px; }
.ev-item { border: 1px solid #e6ecea; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; cursor: pointer; transition: .15s; }
.ev-item:hover { border-color: var(--brand); box-shadow: 0 2px 10px rgba(31,111,84,.12); }
.ev-item.active { border-color: var(--brand); background: #f1f8f5; }
.ev-top { display: flex; justify-content: space-between; }
.ev-title { font-weight: 600; margin: 7px 0 2px; font-size: 14px; }
.ev-code { color: #90a09c; font-size: 12px; }
.ev-meta { color: #8a9a96; font-size: 12px; margin-top: 3px; }
.detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
</style>
