<template>
  <div>
    <div class="page-head">
      <div>
        <h2>备餐 · 留样 · 配送</h2>
        <div class="sub">食堂记录菜单、食材批次、供应商、厨师、留样、温控与分餐时间；高温/雨天/封闭区送餐路线、保温与留样结合安全管理</div>
      </div>
      <div>
        <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false" @change="load" />
        <el-select v-model="sessionId" placeholder="选择餐次" style="width:150px;margin-left:10px" @change="onSession">
          <el-option v-for="s in sessions" :key="s.id" :label="shiftName(s.shift)" :value="s.id" />
        </el-select>
      </div>
    </div>

    <el-tabs v-model="tab">
      <!-- 备餐 -->
      <el-tab-pane label="备餐记录" name="prep">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><Bowl /></el-icon>新增备餐记录</div>
          <el-form :model="prepForm" label-width="96px">
            <el-row :gutter="10">
              <el-col :span="14">
                <el-form-item label="菜单"><el-input v-model="prepForm.menu" type="textarea" :rows="2"
                  placeholder="红烧鸡腿、青椒土豆丝…（清真餐请注明）" /></el-form-item>
              </el-col>
              <el-col :span="10">
                <el-form-item label="食材批次"><el-input v-model="prepForm.ingredientBatch" placeholder="BATCH-20260914-A" /></el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="10">
              <el-col :span="8"><el-form-item label="供应商">
                <el-select v-model="prepForm.supplierId" clearable style="width:100%">
                  <el-option v-for="s in suppliers" :key="s.id" :label="`${s.name}${s.deduction?'（已扣¥'+s.deduction+'）':''}`" :value="s.id" />
                </el-select></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="厨师"><el-input v-model="prepForm.chef" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="分餐时间"><el-input v-model="prepForm.serveTime" placeholder="11:30" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="10">
              <el-col :span="6"><el-form-item label="中心温度℃"><el-input-number v-model="prepForm.coreTemp" :precision="1" :min="0" /></el-form-item></el-col>
              <el-col :span="6"><el-form-item label="环境温度℃"><el-input-number v-model="prepForm.ambientTemp" :precision="1" :min="0" /></el-form-item></el-col>
              <el-col :span="6"><el-form-item label="备餐份数"><el-input-number v-model="prepForm.preparedCount" :min="0" /></el-form-item></el-col>
              <el-col :span="6"><el-form-item label="缺口/报损">
                <el-input-number v-model="prepForm.shortageCount" :min="0" placeholder="缺口" style="width:48%" />
                <el-input-number v-model="prepForm.lossCount" :min="0" style="width:48%;margin-left:4%" /></el-form-item></el-col>
            </el-row>
            <el-form-item label="备注"><el-input v-model="prepForm.note" placeholder="高温天加绿豆汤 / 封闭施工区配送要求" /></el-form-item>
            <el-button type="primary" :icon="Check" @click="savePrep">保存备餐并进入留样</el-button>
          </el-form>
        </el-card>

        <el-card class="soft-card" style="margin-top:14px">
          <div class="section-title"><el-icon><List /></el-icon>本餐次备餐记录</div>
          <el-table :data="preps" stripe>
            <el-table-column prop="menu" label="菜单" min-width="220" show-overflow-tooltip />
            <el-table-column label="供应商" width="130"><template #default="{row}">{{ row.supplier?.name || '—' }}</template></el-table-column>
            <el-table-column prop="chef" label="厨师" width="90" />
            <el-table-column label="中心/环境℃" width="100" align="center">
              <template #default="{row}">{{ row.coreTemp ?? '—' }} / {{ row.ambientTemp ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="serveTime" label="分餐" width="80" />
            <el-table-column label="备/缺/损" width="100" align="center">
              <template #default="{row}">{{ row.preparedCount }} / <span class="money-up">{{ row.shortageCount }}</span> / {{ row.lossCount }}</template>
            </el-table-column>
            <el-table-column label="留样" width="70" align="center">
              <template #default="{row}"><el-tag size="small" type="success">{{ row.samples?.length || 0 }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{row}">
                <el-button size="small" link type="primary" @click="quickSample(row)">+留样</el-button>
                <el-button size="small" link type="warning" @click="reportShortage(row)">菜品不够</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 留样 -->
      <el-tab-pane label="食品留样（48h/125g）" name="sample">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><Refrigerator /></el-icon>留样台账
            <el-radio-group v-model="sampleFilter" size="small" style="margin-left:16px" @change="loadSamples">
              <el-radio-button label="">全部</el-radio-button>
              <el-radio-button label="retained">留样中</el-radio-button>
              <el-radio-button label="passed">检测合格</el-radio-button>
              <el-radio-button label="failed">检测异常</el-radio-button>
            </el-radio-group>
          </div>
          <el-table :data="samples" stripe>
            <el-table-column label="菜品" min-width="140">
              <template #default="{row}">{{ row.dishName }}
                <el-tag v-if="row.dishName.includes('清真')" size="small" type="warning" effect="plain" style="margin-left:4px">清真</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="餐次" width="120">
              <template #default="{row}">{{ row.preparation?.session?.date }} {{ shiftName(row.preparation?.session?.shift) }}</template>
            </el-table-column>
            <el-table-column prop="weightGram" label="重量g" width="80" align="center" />
            <el-table-column prop="boxNo" label="留样盒" width="90" />
            <el-table-column label="冷藏℃" width="80" align="center"><template #default="{row}">{{ row.fridgeTemp }}</template></el-table-column>
            <el-table-column prop="sampledBy" label="留样人" width="90" />
            <el-table-column label="留样/到期" width="150">
              <template #default="{row}">
                <div>{{ fmt(row.sampleAt) }}</div>
                <div class="muted" style="font-size:12px">至 {{ fmt(row.expireAt) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="状态/检测" min-width="180">
              <template #default="{row}">
                <el-tag size="small" :type="sampleTag(row.status)">{{ sampleStatus(row.status) }}</el-tag>
                <div v-if="row.labResult" class="muted" style="font-size:12px">{{ row.labResult }}</div>
              </template>
            </el-table-column>
            <el-table-column label="检测登记" width="150" fixed="right">
              <template #default="{row}">
                <el-button size="small" link type="success" @click="setResult(row,'passed')">合格</el-button>
                <el-button size="small" link type="danger" @click="setResult(row,'failed')">异常</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 配送 -->
      <el-tab-pane label="夜间送餐/保温" name="delivery">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><Van /></el-icon>送餐到分散作业区（塔吊作业区 / 封闭施工区）</div>
          <el-form :model="delForm" label-width="96px">
            <el-row :gutter="10">
              <el-col :span="6"><el-form-item label="送达区域"><el-input v-model="delForm.zone" placeholder="塔吊作业区" /></el-form-item></el-col>
              <el-col :span="6"><el-form-item label="份数"><el-input-number v-model="delForm.count" :min="0" /></el-form-item></el-col>
              <el-col :span="6"><el-form-item label="保温温度℃"><el-input-number v-model="delForm.keepWarmTemp" :precision="0" :min="0" /></el-form-item></el-col>
              <el-col :span="6"><el-form-item label="配送员"><el-input v-model="delForm.carrier" /></el-form-item></el-col>
            </el-row>
            <el-form-item label="送餐路线"><el-input v-model="delForm.route" placeholder="食堂→东侧施工通道→2#塔吊底部安全平台" /></el-form-item>
            <el-form-item label="安全确认">
              <el-input v-model="delForm.safetyCheck" type="textarea" :rows="2"
                placeholder="高空坠物警戒、安全帽、封闭区登记、雨天防滑、夜间照明（安全员确认）" />
            </el-form-item>
            <el-button type="primary" :icon="Position" @click="saveDelivery">登记送餐</el-button>
          </el-form>
        </el-card>
        <el-card class="soft-card" style="margin-top:14px">
          <el-table :data="deliveries" stripe>
            <el-table-column prop="zone" label="送达区域" width="120" />
            <el-table-column prop="route" label="路线" min-width="200" show-overflow-tooltip />
            <el-table-column prop="count" label="份数" width="60" align="center" />
            <el-table-column label="保温℃" width="80" align="center"><template #default="{row}">{{ row.keepWarmTemp ?? '—' }}</template></el-table-column>
            <el-table-column prop="carrier" label="配送员" width="80" />
            <el-table-column prop="safetyCheck" label="安全确认" min-width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{row}">
                <el-select v-model="row.status" size="small" @change="updateDelivery(row)">
                  <el-option label="待出发" value="planned" /><el-option label="配送中" value="in_transit" /><el-option label="已送达" value="delivered" />
                </el-select>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 快速留样弹窗 -->
    <el-dialog v-model="sampleDialog" title="登记食品留样（每菜≥125g，冷藏48小时）" width="480px">
      <el-form :model="sampleForm" label-width="90px">
        <el-form-item label="菜品名称"><el-input v-model="sampleForm.dishName" /></el-form-item>
        <el-form-item label="重量(g)"><el-input-number v-model="sampleForm.weightGram" :min="125" :step="5" /></el-form-item>
        <el-form-item label="留样盒号"><el-input v-model="sampleForm.boxNo" /></el-form-item>
        <el-form-item label="冷藏温度℃"><el-input-number v-model="sampleForm.fridgeTemp" :precision="1" :min="-5" :max="10" /></el-form-item>
        <el-form-item label="留样人"><el-input v-model="sampleForm.sampledBy" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sampleDialog=false">取消</el-button>
        <el-button type="primary" @click="saveSample">确认留样（自动算48h到期）</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Check, Position } from '@element-plus/icons-vue';
import api from '../api';

const SHIFTS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', midnight: '夜宵' };
const shiftName = (s) => SHIFTS[s] || s;
const fmt = (t) => (t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '—');
const sampleStatus = (s) => ({ retained: '留样中', passed: '检测合格', failed: '检测异常', disposed: '已处置' }[s] || s);
const sampleTag = (s) => ({ retained: 'warning', passed: 'success', failed: 'danger', disposed: 'info' }[s] || '');

const date = ref(new Date().toISOString().slice(0, 10));
const sessions = ref([]);
const sessionId = ref(null);
const tab = ref('prep');
const suppliers = ref([]);
const preps = ref([]);
const samples = ref([]);
const deliveries = ref([]);
const sampleFilter = ref('');

const prepForm = reactive({ menu: '', ingredientBatch: '', supplierId: null, chef: '周师傅', coreTemp: 75, ambientTemp: 30, serveTime: '11:30', preparedCount: 20, shortageCount: 0, lossCount: 0, note: '' });
const delForm = reactive({ zone: '', count: 5, keepWarmTemp: 60, carrier: '郑配送', route: '', safetyCheck: '' });
const sampleDialog = ref(false);
const sampleForm = reactive({ preparationId: null, dishName: '', weightGram: 125, boxNo: '', fridgeTemp: 4, sampledBy: '周师傅' });

async function load() {
  sessions.value = await api.get('/meals/sessions', { params: { date: date.value } });
  if (!sessions.value.find((s) => s.id === sessionId.value)) sessionId.value = sessions.value[0]?.id || null;
  await onSession();
}
async function onSession() {
  suppliers.value = await api.get('/org/suppliers');
  if (!sessionId.value) { preps.value = []; deliveries.value = []; return; }
  preps.value = await api.get('/meals/preparations', { params: { sessionId: sessionId.value } });
  deliveries.value = await api.get('/meals/deliveries', { params: { sessionId: sessionId.value } });
  await loadSamples();
}
async function loadSamples() {
  samples.value = await api.get('/meals/samples', { params: sampleFilter.value ? { status: sampleFilter.value } : {} });
}

async function savePrep() {
  if (!prepForm.menu) return ElMessage.warning('请填写菜单');
  await api.post('/meals/preparations', { ...prepForm, sessionId: sessionId.value });
  ElMessage.success('备餐记录已保存，请对每样菜品登记留样');
  prepForm.menu = '';
  await onSession();
  tab.value = 'sample';
  await loadSamples();
}

function quickSample(row) {
  Object.assign(sampleForm, { preparationId: row.id, dishName: '', boxNo: 'BOX-' + row.id, fridgeTemp: 4, sampledBy: row.chef || '周师傅' });
  sampleDialog.value = true;
}
async function saveSample() {
  if (!sampleForm.dishName) return ElMessage.warning('请填写菜品名称');
  await api.post('/meals/samples', sampleForm);
  ElMessage.success('留样已登记，48 小时后到期');
  sampleDialog.value = false;
  await loadSamples();
  await onSession();
}
async function setResult(row, status) {
  let labResult;
  if (status === 'failed') {
    const { value } = await ElMessageBox.prompt('请填写检测异常说明（将触发变质投诉协同与供应商扣款）', '留样检测异常', {
      confirmButtonText: '提交并报安全员', inputType: 'textarea', inputPlaceholder: '如：菌落总数超标',
    }).catch(() => ({ value: null }));
    if (value === null || value === undefined) return;
    labResult = value;
  }
  await api.post(`/meals/samples/${row.id}/result`, { status, labResult });
  ElMessage.success(status === 'failed' ? '已登记异常，请在「异常协同」发起变质投诉' : '检测合格已登记');
  await loadSamples();
}

async function reportShortage(row) {
  await ElMessageBox.confirm('将跳转异常协同，发起「菜品不够」工单，通知班组长与项目部。', '菜品不够', { type: 'warning' }).catch(() => null);
  ElMessage.info('请在「异常协同」页面提交 SHORTAGE 工单');
}

async function saveDelivery() {
  if (!delForm.zone) return ElMessage.warning('请填写送达区域');
  await api.post('/meals/deliveries', { ...delForm, sessionId: sessionId.value, status: 'planned' });
  ElMessage.success('送餐任务已登记');
  delForm.zone = ''; delForm.route = ''; delForm.safetyCheck = '';
  await onSession();
}
async function updateDelivery(row) {
  await api.patch(`/meals/deliveries/${row.id}`, { status: row.status });
  ElMessage.success('配送状态已更新');
}

onMounted(load);
</script>
