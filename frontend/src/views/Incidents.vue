<template>
  <div>
    <div class="page-head">
      <div>
        <h2>异常协同（同一餐次·五方联动）</h2>
        <div class="sub">临时停工、班组人数变动、菜品不够、变质投诉、夜宵送塔吊区、补贴争议等，把班组长、食堂、项目部、财务、安全员放在同一餐次里处理</div>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">发起异常工单</el-button>
    </div>

    <el-row :gutter="14">
      <!-- 工单列表 -->
      <el-col :span="9">
        <el-card class="soft-card">
          <el-radio-group v-model="filterStatus" size="small" style="margin-bottom:10px" @change="load">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="open">处理中</el-radio-button>
            <el-radio-button label="resolved">已解决</el-radio-button>
          </el-radio-group>
          <el-scrollbar height="640px">
            <div v-for="i in list" :key="i.id" class="inc-item" :class="{ active: current?.id===i.id }" @click="select(i)">
              <div class="inc-top">
                <el-tag size="small" :type="typeColor(i.type)">{{ typeName(i.type) }}</el-tag>
                <el-tag size="small" :type="i.status==='open'?'danger':'success'" effect="plain">
                  {{ i.status==='open'?'处理中':'已解决' }}
                </el-tag>
              </div>
              <div class="inc-title">{{ i.title }}</div>
              <div class="inc-meta">
                <el-icon v-if="i.severity==='high'"><WarnTriangleFilled /></el-icon>
                {{ i.session ? `${i.session.date} ${shiftName(i.session.shift)}` : '未关联餐次' }}
                · {{ i.involvedRoles.split(',').map(r=>roleShort(r)).join('/') }}
              </div>
            </div>
          </el-scrollbar>
        </el-card>
      </el-col>

      <!-- 协同详情 -->
      <el-col :span="15">
        <el-card class="soft-card" v-if="current">
          <div class="detail-head">
            <div>
              <h3 style="margin:0">{{ current.title }}
                <el-tag size="small" :type="sevColor(current.severity)" style="margin-left:8px">{{ sevName(current.severity) }}</el-tag>
              </h3>
              <div class="muted" style="margin-top:4px">
                {{ typeName(current.type) }} · 报告人 {{ current.reporter?.name }} ·
                协同角色：
                <el-tag v-for="r in current.involvedRoles.split(',')" :key="r" size="small" class="tag-gap" effect="plain">
                  {{ roleShort(r) }}
                </el-tag>
              </div>
            </div>
          </div>

          <el-alert :title="current.description" type="info" :closable="false" style="margin:12px 0" />

          <!-- 多方处理时间线 -->
          <el-timeline style="margin-top:14px">
            <el-timeline-item v-for="a in current.actions" :key="a.id" :timestamp="fmtTime(a.createdAt)"
              :type="actionColor(a.actorRole)" placement="top">
              <el-tag size="small" :type="actionColor(a.actorRole)">{{ roleShort(a.actorRole) }}</el-tag>
              <span style="margin-left:8px">{{ a.content }}</span>
              <el-tag v-if="a.action && a.action!=='comment' && a.action!=='create'" size="small" type="warning" effect="plain" style="margin-left:6px">
                {{ actionName(a.action) }}
              </el-tag>
            </el-timeline-item>
          </el-timeline>

          <!-- 处理动作 -->
          <el-divider>我要协同处理</el-divider>
          <el-input v-model="reply" type="textarea" :rows="2" placeholder="以当前角色身份追加处理意见（如：已现场核实、同意扣款、改送他区）" />
          <el-space wrap style="margin-top:10px">
            <el-button size="small" @click="addAction('comment','')">提交意见</el-button>
            <el-button size="small" type="danger" plain v-if="current.sessionId" @click="quickAction('confirm_stopwork','确认停工：本餐次订餐取消并通知食堂停餐')">班组长/项目部·确认停工取消餐次</el-button>
            <el-button size="small" type="warning" plain @click="adjustOrder">食堂/项目部·按班组调整生成量</el-button>
            <el-button size="small" type="danger" plain @click="deduct">财务·对供应商扣款</el-button>
          </el-space>

          <!-- 结案 -->
          <el-divider />
          <el-input v-model="resolution" type="textarea" :rows="2" placeholder="处理结论（责任方、补发/扣款、食品安全处置）" />
          <el-row :gutter="10" style="margin-top:10px">
            <el-col :span="10">
              <el-input v-model="responsibleParty" placeholder="责任方，如 正大红肉联/食堂" />
            </el-col>
            <el-col :span="6">
              <el-input-number v-model="amount" :min="0" :precision="2" placeholder="调整金额" style="width:100%" />
            </el-col>
            <el-col :span="8">
              <el-space>
                <el-button type="primary" @click="resolve" :disabled="current.status!=='open'">结案归档</el-button>
                <el-button v-if="current.status==='resolved'" @click="reopen">重新打开</el-button>
              </el-space>
            </el-col>
          </el-row>
          <el-alert v-if="current.status==='resolved'" type="success" :closable="false" style="margin-top:12px"
            :title="`已结案：${current.resolution || '（见结论）'}｜责任方 ${current.responsibleParty||'—'}｜调整 ¥${current.adjustmentAmount}`" />
        </el-card>
        <el-empty v-else description="请选择左侧异常工单" />
      </el-col>
    </el-row>

    <!-- 发起工单 -->
    <el-dialog v-model="createVisible" title="发起异常协同工单" width="560px">
      <el-form :model="form" label-width="92px">
        <el-form-item label="异常类型">
          <el-select v-model="form.type" style="width:100%" @change="onTypeChange">
            <el-option v-for="(n,k) in TYPES" :key="k" :label="n" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="关联餐次">
          <el-select v-model="form.sessionId" clearable style="width:100%">
            <el-option v-for="s in sessions" :key="s.id" :label="`${s.date} ${shiftName(s.shift)}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="严重程度">
          <el-radio-group v-model="form.severity">
            <el-radio label="low">一般</el-radio><el-radio label="medium">较重</el-radio><el-radio label="high">紧急</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="协同角色">
          <el-checkbox-group v-model="form.involvedRoles">
            <el-checkbox v-for="(n,k) in ROLES" :key="k" :label="k">{{ n }}</el-checkbox>
          </el-checkbox-group>
          <div class="muted" style="font-size:12px">不勾选则按异常类型自动推荐协同角色</div>
        </el-form-item>
        <el-form-item label="情况描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible=false">取消</el-button>
        <el-button type="primary" @click="submitCreate">提交并通知各方</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../api';

const TYPES = {
  STOPWORK: '临时停工', TEAM_CHANGE: '班组人数变动', SHORTAGE: '菜品不够',
  SPOILED: '变质投诉', NIGHT_ZONE: '夜宵送塔吊区', SUBSIDY_DISPUTE: '补贴金额争议',
  RECEPTION: '项目部临时接待', WEATHER: '高温/雨天送餐留样', UNVERIFIED: '新工人未实名', CROSS_TEAM: '跨班组取餐',
};
const ROLES = { FOREMAN: '班组长', CANTEEN: '食堂', PROJECT: '项目部', FINANCE: '财务', SAFETY: '安全员' };
const DEFAULT_ROLES = {
  STOPWORK: ['FOREMAN','PROJECT','CANTEEN','FINANCE'], TEAM_CHANGE: ['FOREMAN','PROJECT','CANTEEN'],
  SHORTAGE: ['CANTEEN','FOREMAN','PROJECT'], SPOILED: ['CANTEEN','SAFETY','FINANCE','PROJECT'],
  NIGHT_ZONE: ['FOREMAN','CANTEEN','SAFETY'], SUBSIDY_DISPUTE: ['FOREMAN','FINANCE','PROJECT'],
  RECEPTION: ['PROJECT','CANTEEN','FINANCE'], WEATHER: ['CANTEEN','SAFETY','FOREMAN'],
  UNVERIFIED: ['FOREMAN','PROJECT'], CROSS_TEAM: ['FOREMAN','CANTEEN','FINANCE'],
};
const SHIFTS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', midnight: '夜宵' };
const shiftName = (s) => SHIFTS[s] || s;
const typeName = (t) => TYPES[t] || t;
const roleShort = (r) => ROLES[r] || r;
const sevName = (s) => ({ low: '一般', medium: '较重', high: '紧急' }[s] || s);
const sevColor = (s) => ({ low: 'info', medium: 'warning', high: 'danger' }[s] || '');
const typeColor = (t) => ({ SPOILED: 'danger', STOPWORK: 'danger', SUBSIDY_DISPUTE: 'warning', SHORTAGE: 'warning', NIGHT_ZONE: 'primary', WEATHER: 'primary' }[t] || '');
const actionColor = (r) => ({ FOREMAN: 'primary', CANTEEN: 'warning', PROJECT: 'success', FINANCE: 'info', SAFETY: 'danger', ADMIN: 'danger' }[r] || '');
const actionName = (a) => ({ confirm_stopwork: '停工取消餐次', adjust_order: '调整订餐', deduct_supplier: '供应商扣款', safety_approve: '安全确认' }[a] || a);
const fmtTime = (t) => new Date(t).toLocaleString('zh-CN', { hour12: false });

const list = ref([]);
const current = ref(null);
const filterStatus = ref('');
const sessions = ref([]);
const reply = ref('');
const resolution = ref('');
const responsibleParty = ref('');
const amount = ref(0);
const createVisible = ref(false);
const form = reactive({ type: 'SPOILED', title: '', sessionId: null, severity: 'medium', involvedRoles: [], description: '' });

async function load() {
  list.value = await api.get('/incidents', { params: filterStatus.value ? { status: filterStatus.value } : {} });
  if (current.value) {
    const fresh = list.value.find((i) => i.id === current.value.id) || await api.get(`/incidents/${current.value.id}`);
    current.value = fresh;
  }
}
async function select(i) { current.value = await api.get(`/incidents/${i.id}`); resolution.value = current.value.resolution || ''; responsibleParty.value = current.value.responsibleParty || ''; amount.value = Number(current.value.adjustmentAmount) || 0; }

function openCreate() {
  Object.assign(form, { type: 'SPOILED', title: '', sessionId: sessions.value[0]?.id || null, severity: 'medium', involvedRoles: DEFAULT_ROLES.SPOILED.slice(), description: '' });
  createVisible.value = true;
}
function onTypeChange() { form.involvedRoles = (DEFAULT_ROLES[form.type] || []).slice(); }
async function submitCreate() {
  if (!form.title || !form.description) return ElMessage.warning('请填写标题与描述');
  const created = await api.post('/incidents', { ...form, involvedRoles: form.involvedRoles.join(',') });
  ElMessage.success('工单已创建并通知协同角色');
  createVisible.value = false;
  await load();
  current.value = created;
}

async function addAction(action, content) {
  const text = content || reply.value;
  if (!text) return ElMessage.warning('请填写处理意见');
  current.value = await api.post(`/incidents/${current.value.id}/actions`, { content: text, action });
  reply.value = '';
  ElMessage.success('已提交协同处理');
  await load();
}
function quickAction(action, content) { reply.value = content; addAction(action, content); }

async function adjustOrder() {
  const { value } = await ElMessageBox.prompt('输入 班组ID:新生成分数（可在订餐页查看班组ID），如 2:18', '按班组调整订餐', {
    inputPattern: /\d+\s*[:：]\s*\d+/, inputErrorMessage: '格式如 2:18',
  }).catch(() => ({ value: null }));
  if (!value) return;
  current.value = await api.post(`/incidents/${current.value.id}/actions`, { content: value, action: 'adjust_order' });
  ElMessage.success('订餐生成量已调整');
  await load();
}
async function deduct() {
  const { value } = await ElMessageBox.prompt('输入 供应商ID:扣款金额，如 2:500', '供应商扣款（计入后勤档案）', {
    inputPattern: /\d+\s*[:：]\s*\d+(\.\d+)?/, inputErrorMessage: '格式如 2:500',
  }).catch(() => ({ value: null }));
  if (!value) return;
  current.value = await api.post(`/incidents/${current.value.id}/actions`, { content: value, action: 'deduct_supplier' });
  ElMessage.success('扣款已记录到供应商档案');
  await load();
}
async function resolve() {
  if (!resolution.value) return ElMessage.warning('请填写处理结论');
  current.value = await api.post(`/incidents/${current.value.id}/resolve`, {
    resolution: resolution.value, responsibleParty: responsibleParty.value, adjustmentAmount: amount.value,
  });
  ElMessage.success('工单已结案并归档');
  await load();
}
async function reopen() {
  current.value = await api.post(`/incidents/${current.value.id}/reopen`, {});
  await load();
}

onMounted(async () => {
  sessions.value = await api.get('/meals/sessions');
  await load();
});
</script>

<style scoped>
.inc-item { border:1px solid #e6ecea; border-radius:10px; padding:10px 12px; margin-bottom:10px; cursor:pointer; transition:.15s; }
.inc-item:hover { border-color: var(--brand); box-shadow: 0 2px 10px rgba(31,111,84,.12); }
.inc-item.active { border-color: var(--brand); background:#f1f8f5; }
.inc-top { display:flex; justify-content:space-between; }
.inc-title { font-weight:600; margin:7px 0 4px; font-size:14px; }
.inc-meta { color:#8a9a96; font-size:12px; display:flex; align-items:center; gap:3px; flex-wrap:wrap; }
</style>
