<template>
  <div>
    <div class="page-head">
      <div>
        <h2>订餐申报与智能生成</h2>
        <div class="sub">班组长每日申报用餐人数、工种、班次、夜宵需求、少数民族餐与临时加班；平台依据实名考勤、宿舍人数、施工计划与食堂产能生成订餐</div>
      </div>
      <div>
        <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false" @change="load" />
        <el-button type="primary" :icon="MagicStick" :loading="genLoading" style="margin-left:10px"
          @click="generate">按考勤+产能生成订餐</el-button>
        <el-button :icon="Plus" @click="openCreate">新建餐次</el-button>
      </div>
    </div>

    <el-tabs v-model="activeSession" @tab-change="loadOrders">
      <el-tab-pane v-for="s in sessions" :key="s.id" :name="String(s.id)">
        <template #label>
          <el-badge :hidden="(s.orderedCount||0)===0" :value="`${s.generatedCount||s.orderedCount||0}份`" type="primary">
            <span style="padding:0 14px">{{ shiftName(s.shift) }}
              <el-tag size="small" :type="statusType(s.status)" effect="plain" style="margin-left:4px">{{ statusName(s.status) }}</el-tag>
            </span>
          </el-badge>
        </template>
      </el-tab-pane>
    </el-tabs>

    <el-row :gutter="14" v-if="session">
      <el-col :span="15">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><EditPen /></el-icon>班组长订餐申报（{{ session.date }} {{ shiftName(session.shift) }}）
            <el-tag v-if="session.weather" size="small" type="warning" effect="plain" style="margin-left:8px">天气：{{ session.weather }}</el-tag>
          </div>
          <el-alert type="info" :closable="false" style="margin-bottom:12px">
            <template #title>
              餐标 ¥{{ session.price }}｜个人餐补 ¥{{ session.workerSubsidy }}｜企业补贴 ¥{{ session.companySubsidy }}｜
              食堂产能 {{ capacity }} 份/餐
            </template>
          </el-alert>
          <el-table :data="orders" stripe size="default">
            <el-table-column label="班组" min-width="110">
              <template #default="{ row }">{{ row.team?.name }}</template>
            </el-table-column>
            <el-table-column label="申报人数" width="84" align="center">
              <template #default="{ row }"><el-input-number v-model="row.headcount" :min="0" size="small" controls-position="right" style="width:78px" /></template>
            </el-table-column>
            <el-table-column prop="trades" label="工种" width="100" />
            <el-table-column label="夜宵" width="74" align="center">
              <template #default="{ row }"><el-input-number v-model="row.nightSnackCount" :min="0" size="small" controls-position="right" style="width:68px" /></template>
            </el-table-column>
            <el-table-column label="少数民族餐" width="92" align="center">
              <template #default="{ row }"><el-input-number v-model="row.ethnicCount" :min="0" size="small" controls-position="right" style="width:84px" /></template>
            </el-table-column>
            <el-table-column label="临时加班" width="74" align="center">
              <template #default="{ row }"><el-input-number v-model="row.overtimeCount" :min="0" size="small" controls-position="right" style="width:68px" /></template>
            </el-table-column>
            <el-table-column label="生成量" width="70" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status==='adjusted'?'warning':'success'" size="small">{{ row.generatedCount || '—' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="92" align="center" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="saveOrder(row)">保存申报</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-form inline style="margin-top:14px">
            <el-form-item label="送餐/取餐区域"><el-input v-model="zone" placeholder="如 塔吊作业区 / 夜间浇筑区" style="width:220px" /></el-form-item>
            <el-form-item><el-button @click="saveZone">同步送餐区域到全部申报</el-button></el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="9">
        <el-card class="soft-card" style="margin-bottom:14px">
          <div class="section-title"><el-icon><DataAnalysis /></el-icon>本餐次汇总</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="申报班组">{{ session.orderTeams }}</el-descriptions-item>
            <el-descriptions-item label="申报总份数">{{ session.orderedCount }}</el-descriptions-item>
            <el-descriptions-item label="生成总份数">{{ session.generatedCount }}</el-descriptions-item>
            <el-descriptions-item label="实际备餐">{{ session.preparedCount }}</el-descriptions-item>
            <el-descriptions-item label="已取餐">{{ session.pickedCount }}</el-descriptions-item>
            <el-descriptions-item label="取餐率">{{ session.pickupRate }}%</el-descriptions-item>
            <el-descriptions-item label="浪费/报损">{{ session.wastedCount }} 份</el-descriptions-item>
            <el-descriptions-item label="浪费率">{{ session.wasteRate }}%</el-descriptions-item>
          </el-descriptions>
          <el-space wrap style="margin-top:12px">
            <el-button size="small" @click="setStatus('preparing')">通知食堂备餐</el-button>
            <el-button size="small" type="warning" plain @click="setStatus('stopped')">临时停工·取消餐次</el-button>
          </el-space>
        </el-card>

        <el-card class="soft-card" v-if="genResult">
          <div class="section-title"><el-icon><MagicStick /></el-icon>智能生成说明</div>
          <el-alert :type="genResult.capacityAdjusted ? 'warning' : 'success'" :closable="false">
            <template #title>
              需求合计 {{ genResult.totalWant }} 份，食堂产能 {{ genResult.capacity }} 份；
              <span v-if="genResult.capacityAdjusted">产能不足，已按比例压缩并优先保留少数民族餐</span>
              <span v-else>产能充足，按实名考勤在岗人数 + 临时加班足额生成 {{ genResult.generated }} 份</span>
            </template>
          </el-alert>
        </el-card>
      </el-col>
    </el-row>

    <!-- 新建餐次 -->
    <el-dialog v-model="createVisible" title="新建餐次" width="520px">
      <el-form :model="createForm" label-width="92px">
        <el-form-item label="日期"><el-date-picker v-model="createForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="班次">
          <el-select v-model="createForm.shift" style="width:100%">
            <el-option v-for="(n,k) in SHIFTS" :key="k" :label="n" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="食堂">
          <el-select v-model="createForm.canteenId" style="width:100%">
            <el-option v-for="c in canteens" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="8">
          <el-col :span="8"><el-form-item label="餐标"><el-input-number v-model="createForm.price" :min="1" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="个人餐补"><el-input-number v-model="createForm.workerSubsidy" :min="0" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="企业补贴"><el-input-number v-model="createForm.companySubsidy" :min="0" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="天气">
          <el-select v-model="createForm.weather" clearable style="width:100%">
            <el-option label="晴" value="晴" /><el-option label="高温" value="高温" />
            <el-option label="雨" value="雨" /><el-option label="夜间" value="夜间" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible=false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MagicStick, Plus } from '@element-plus/icons-vue';
import api from '../api';

const SHIFTS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', midnight: '夜宵' };
const shiftName = (s) => SHIFTS[s] || s;
const statusName = (s) => ({ open: '订餐中', confirmed: '已生成', preparing: '备餐中', serving: '分餐中', closed: '已结束', stopped: '停工取消' }[s] || s);
const statusType = (s) => ({ open: 'info', confirmed: 'primary', preparing: 'warning', serving: 'success', closed: '', stopped: 'danger' }[s] || '');

const date = ref(new Date().toISOString().slice(0, 10));
const sessions = ref([]);
const activeSession = ref('');
const orders = ref([]);
const canteens = ref([]);
const zone = ref('');
const genLoading = ref(false);
const genResult = ref(null);
const createVisible = ref(false);
const createForm = reactive({ date: date.value, shift: 'lunch', canteenId: null, price: 15, workerSubsidy: 8, companySubsidy: 5, weather: '晴' });

const session = computed(() => sessions.value.find((s) => String(s.id) === activeSession.value) || null);
const capacity = computed(() => session.value?.canteen?.capacity || '—');

async function load() {
  sessions.value = await api.get('/meals/sessions', { params: { date: date.value } });
  canteens.value = await api.get('/org/canteens');
  if (!createForm.canteenId && canteens.value[0]) createForm.canteenId = canteens.value[0].id;
  if (sessions.value.length && !sessions.value.find((s) => String(s.id) === activeSession.value)) {
    activeSession.value = String(sessions.value[0].id);
  }
  await loadOrders();
}

async function loadOrders() {
  if (!activeSession.value) return;
  const id = +activeSession.value;
  orders.value = await api.get('/meals/orders', { params: { sessionId: id } });
  const s = await api.get(`/meals/sessions/${id}`);
  const idx = sessions.value.findIndex((x) => x.id === id);
  if (idx >= 0) sessions.value[idx] = s;
  zone.value = orders.value.find((o) => o.deliveryZone)?.deliveryZone || '';
  genResult.value = null;
}

async function saveOrder(row) {
  await api.post('/meals/orders', {
    sessionId: +activeSession.value, teamId: row.teamId,
    headcount: row.headcount, trades: row.trades,
    nightSnackCount: row.nightSnackCount, ethnicCount: row.ethnicCount, overtimeCount: row.overtimeCount,
    deliveryZone: zone.value,
  });
  ElMessage.success(`${row.team?.name} 订餐申报已保存`);
  await loadOrders();
}

async function saveZone() {
  for (const o of orders.value) {
    await api.post('/meals/orders', { ...o, sessionId: +activeSession.value, deliveryZone: zone.value });
  }
  ElMessage.success('送餐区域已同步');
}

async function generate() {
  genLoading.value = true;
  try {
    genResult.value = await api.post(`/meals/sessions/${activeSession.value}/generate`);
    orders.value = genResult.value.orders;
    ElMessage.success('订餐已根据实名考勤与食堂产能生成');
    await loadOrders();
  } finally { genLoading.value = false; }
}

async function setStatus(st) {
  if (st === 'stopped') {
    try {
      await ElMessageBox.confirm('确认本餐次因临时停工取消？取消后将进入异常协同流程。', '停工确认', { type: 'warning' });
    } catch { return; }
  }
  await api.post(`/meals/sessions/${activeSession.value}/status`, { status: st });
  ElMessage.success('餐次状态已更新');
  await load();
}

function openCreate() { createForm.date = date.value; createVisible.value = true; }
async function submitCreate() {
  await api.post('/meals/sessions', createForm);
  ElMessage.success('餐次已创建');
  createVisible.value = false;
  await load();
}

onMounted(load);
</script>
