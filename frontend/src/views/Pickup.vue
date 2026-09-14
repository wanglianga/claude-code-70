<template>
  <div>
    <div class="page-head">
      <div>
        <h2>取餐终端（刷脸 / 扫码）</h2>
        <div class="sub">工人刷脸或扫码取餐后，平台实时核算个人餐补、企业补贴与自费；自动识别未实名与跨班组取餐</div>
      </div>
      <el-select v-model="sessionId" placeholder="选择餐次" style="width:230px" @change="loadRecent">
        <el-option v-for="s in sessions" :key="s.id"
          :label="`${s.date} ${shiftName(s.shift)}（${statusName(s.status)}）`" :value="s.id" />
      </el-select>
    </div>

    <el-row :gutter="14">
      <el-col :span="11">
        <el-card class="soft-card terminal">
          <el-radio-group v-model="method" class="method" size="large">
            <el-radio-button label="face"><el-icon><Avatar /></el-icon> 刷脸取餐</el-radio-button>
            <el-radio-button label="code"><el-icon><FullScreen /></el-icon> 扫码取餐</el-radio-button>
          </el-radio-group>

          <!-- 刷脸：选择工人（模拟人脸识别一体机） -->
          <div v-if="method==='face'" class="face-box">
            <el-icon :size="64" color="#1f6f54"><Avatar /></el-icon>
            <div class="muted">人脸识别一体机（演示：选择工人模拟识别）</div>
            <el-select v-model="workerId" filterable placeholder="选择/搜索工人（刷脸）" style="width:100%;margin-top:10px">
              <el-option v-for="w in workers" :key="w.id"
                :label="`${w.name}｜${w.team?.name}｜${w.verified?'已实名':'未实名'}`" :value="w.id">
                <span>{{ w.name }}</span>
                <el-tag size="small" :type="w.verified?'success':'danger'" effect="plain" style="margin:0 6px">{{ w.verified?'已实名':'未实名' }}</el-tag>
                <span class="muted">{{ w.team?.name }} · {{ w.ethnicity==='汉'?'汉族':w.ethnicity }}</span>
              </el-option>
            </el-select>
          </div>

          <!-- 扫码 -->
          <div v-else class="face-box">
            <el-icon :size="64" color="#2f7ed8"><FullScreen /></el-icon>
            <div class="muted">闸机扫描取餐二维码</div>
            <el-input v-model="code" size="large" placeholder="输入/扫描取餐码，如 P1001" style="margin-top:10px" @keyup.enter="doPickup" />
          </div>

          <el-divider />
          <div class="cross">
            <span>取餐点所属班组：</span>
            <el-select v-model="teamId" clearable placeholder="默认工人所在班组（跨班组时选择）" style="flex:1">
              <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
            </el-select>
          </div>
          <el-button type="primary" size="large" style="width:100%;margin-top:16px" :loading="loading" @click="doPickup">
            确认取餐并核算费用
          </el-button>
          <el-alert v-if="lastUnverified" type="error" :closable="false" style="margin-top:12px"
            title="该工人尚未实名，本餐暂不享受补贴、全额自费；请引导其完成实名后可发起补贴争议补发。" />
        </el-card>
      </el-col>

      <el-col :span="13">
        <el-card class="soft-card" v-if="last">
          <div class="section-title"><el-icon><Tickets /></el-icon>本笔取餐结算</div>
          <el-result :icon="last.unverified?'warning':'success'" :title="`${last.worker.name} 取餐成功`"
            :subTitle="`${last.team.name} · ${last.crossTeam?'跨班组取餐':'本班组'} · ${last.method==='face'?'刷脸':'扫码'}`">
            <template #extra>
              <el-descriptions :column="4" border size="small" style="width:100%">
                <el-descriptions-item label="餐标">¥{{ last.price }}</el-descriptions-item>
                <el-descriptions-item label="个人餐补"><span class="money-sub">-¥{{ last.workerSubsidy }}</span></el-descriptions-item>
                <el-descriptions-item label="企业补贴"><span class="money-sub">-¥{{ last.companySubsidy }}</span></el-descriptions-item>
                <el-descriptions-item label="工人自付"><span class="money-up">¥{{ last.selfPay }}</span></el-descriptions-item>
              </el-descriptions>
            </template>
          </el-result>
        </el-card>

        <el-card class="soft-card" style="margin-top:14px">
          <div class="section-title"><el-icon><List /></el-icon>本餐次取餐流水</div>
          <el-table :data="recent" stripe size="small" height="360">
            <el-table-column label="工人" min-width="90">
              <template #default="{row}">{{ row.worker?.name }}
                <el-icon v-if="row.unverified" color="#c45656"><WarningFilled /></el-icon>
              </template>
            </el-table-column>
            <el-table-column label="所属/取餐班组" min-width="150">
              <template #default="{row}">
                {{ row.worker?.team?.name }}
                <el-icon v-if="row.crossTeam" color="#e6a23c"><Right /></el-icon>
                {{ row.team?.name }}
              </template>
            </el-table-column>
            <el-table-column label="方式" width="70"><template #default="{row}">{{ row.method==='face'?'刷脸':'扫码' }}</template></el-table-column>
            <el-table-column label="餐补" width="70" align="center"><template #default="{row}">¥{{ row.workerSubsidy }}</template></el-table-column>
            <el-table-column label="企补" width="70" align="center"><template #default="{row}">¥{{ row.companySubsidy }}</template></el-table-column>
            <el-table-column label="自付" width="70" align="center"><template #default="{row}"><span class="money-up">¥{{ row.selfPay }}</span></template></el-table-column>
            <el-table-column label="时间" width="90"><template #default="{row}">{{ new Date(row.createdAt).toLocaleTimeString('zh-CN',{hour12:false}) }}</template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api';

const SHIFTS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', midnight: '夜宵' };
const shiftName = (s) => SHIFTS[s] || s;
const statusName = (s) => ({ open: '订餐中', confirmed: '已生成', preparing: '备餐中', serving: '分餐中', closed: '已结束', stopped: '停工取消' }[s] || s);

const sessions = ref([]);
const sessionId = ref(null);
const workers = ref([]);
const teams = ref([]);
const method = ref('face');
const workerId = ref(null);
const code = ref('');
const teamId = ref(null);
const recent = ref([]);
const last = ref(null);
const loading = ref(false);
const lastUnverified = computed(() => last.value?.unverified);

async function load() {
  sessions.value = await api.get('/meals/sessions');
  const serving = sessions.value.find((s) => ['serving', 'confirmed', 'preparing'].includes(s.status));
  sessionId.value = (serving || sessions.value[0])?.id || null;
  workers.value = await api.get('/org/workers');
  teams.value = await api.get('/org/teams');
  await loadRecent();
}
async function loadRecent() {
  if (!sessionId.value) return;
  recent.value = await api.get('/meals/pickups', { params: { sessionId: sessionId.value } });
}

async function doPickup() {
  if (!sessionId.value) return ElMessage.warning('请选择餐次');
  if (method.value === 'face' && !workerId.value) return ElMessage.warning('请选择工人（模拟刷脸）');
  if (method.value === 'code' && !code.value) return ElMessage.warning('请输入取餐码');
  loading.value = true;
  try {
    const payload = { sessionId: sessionId.value, method: method.value, operator: '取餐终端' };
    if (method.value === 'face') payload.workerId = workerId.value;
    else payload.code = code.value.trim();
    if (teamId.value) payload.teamId = teamId.value;
    last.value = await api.post('/meals/pickup', payload);
    ElMessage.success(last.value.unverified ? '取餐成功（未实名·全额自费）' : '取餐成功，补贴已核算');
    code.value = '';
    await loadRecent();
  } catch { /* toast handled */ } finally { loading.value = false; }
}

onMounted(load);
</script>

<style scoped>
.terminal { min-height: 420px; }
.method { width: 100%; }
.method :deep(.el-radio-button) { width: 50%; }
.method :deep(.el-radio-button__inner) { width: 100%; }
.face-box { text-align: center; padding: 26px 10px 8px; }
.cross { display: flex; align-items: center; gap: 8px; color: #5b6b67; font-size: 13px; }
</style>
