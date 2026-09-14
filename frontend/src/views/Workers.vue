<template>
  <div>
    <div class="page-head">
      <div>
        <h2>工人实名与考勤</h2>
        <div class="sub">新工人未实名可登记补录（身份证+人脸）；实名考勤是订餐生成与补贴核算依据；支持跨班组调动</div>
      </div>
      <div>
        <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false" @change="loadAttendance" />
        <el-button type="primary" :icon="Plus" style="margin-left:10px" @click="openAdd">新增工人</el-button>
      </div>
    </div>

    <el-card class="soft-card">
      <el-space style="margin-bottom:12px" wrap>
        <el-select v-model="filterTeam" clearable placeholder="全部班组" style="width:160px" @change="loadWorkers">
          <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
        <el-radio-group v-model="filterVerified" @change="loadWorkers">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="true">已实名</el-radio-button>
          <el-radio-button label="false">未实名</el-radio-button>
        </el-radio-group>
        <el-button :icon="Check" type="success" plain @click="batchAttendance('day')">按当前名单登记今日白班考勤</el-button>
      </el-space>

      <el-table :data="workers" stripe>
        <el-table-column prop="id" label="工号" width="70" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column label="班组/工种" min-width="150">
          <template #default="{row}">{{ row.team?.name }} · {{ row.trade }}</template>
        </el-table-column>
        <el-table-column prop="ethnicity" label="民族" width="80">
          <template #default="{row}">{{ row.ethnicity }}<el-tag v-if="row.ethnicity!=='汉'" size="small" type="warning" effect="plain" style="margin-left:4px">清真</el-tag></template>
        </el-table-column>
        <el-table-column label="实名" width="150">
          <template #default="{row}">
            <el-tag size="small" :type="row.verified?'success':'danger'">{{ row.verified?'已实名':'未实名' }}</el-tag>
            <span class="muted" style="font-size:12px;margin-left:4px">{{ row.verified?'人脸已录':'新工人' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pickupCode" label="取餐码" width="100" />
        <el-table-column label="今日白班" width="100" align="center">
          <template #default="{row}">
            <el-tag size="small" :type="attMap[row.id]?.day ? 'success':'info'">{{ attMap[row.id]?.day ? '在岗':'缺勤' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="今日夜班" width="100" align="center">
          <template #default="{row}">
            <el-tag size="small" :type="attMap[row.id]?.night ? 'warning':'info'">{{ attMap[row.id]?.night ? '在岗('+(attMap[row.id].nightLoc||'')+')':'—' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{row}">
            <el-button size="small" link type="warning" v-if="!row.verified" @click="openVerify(row)">实名登记</el-button>
            <el-button size="small" link @click="toggleAtt(row,'day')">{{ attMap[row.id]?.day?'设缺勤':'白班在岗' }}</el-button>
            <el-button size="small" link @click="toggleAtt(row,'night')">夜班</el-button>
            <el-button size="small" link type="primary" @click="openTransfer(row)">调动</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增工人 -->
    <el-dialog v-model="addVisible" title="新增工人" width="460px">
      <el-form :model="addForm" label-width="90px">
        <el-form-item label="姓名"><el-input v-model="addForm.name" /></el-form-item>
        <el-form-item label="班组">
          <el-select v-model="addForm.teamId" style="width:100%">
            <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="工种"><el-input v-model="addForm.trade" placeholder="钢筋工/混凝土工/架子工" /></el-form-item>
        <el-form-item label="民族"><el-input v-model="addForm.ethnicity" placeholder="汉 / 回族 ..." /></el-form-item>
        <el-alert type="info" :closable="false" title="新工人默认未实名，需在列表中完成身份证+人脸登记后方可享受餐补。" />
      </el-form>
      <template #footer>
        <el-button @click="addVisible=false">取消</el-button>
        <el-button type="primary" @click="submitAdd">保存</el-button>
      </template>
    </el-dialog>

    <!-- 实名登记 -->
    <el-dialog v-model="verifyVisible" title="新工人实名登记（身份证 + 人脸）" width="460px">
      <el-form :model="verifyForm" label-width="90px">
        <el-form-item label="姓名"><el-input :model-value="verifyName" disabled /></el-form-item>
        <el-form-item label="身份证号"><el-input v-model="verifyForm.idCard" placeholder="18 位身份证号" /></el-form-item>
        <el-form-item label="人脸采集">
          <div class="face-collect">
            <el-icon :size="46" color="#1f6f54"><Avatar /></el-icon>
            <el-button type="primary" plain size="small" @click="verifyForm.faceToken='FACE-'+Date.now()">模拟采集人脸特征</el-button>
            <el-tag v-if="verifyForm.faceToken" type="success" size="small">已采集 {{ verifyForm.faceToken }}</el-tag>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="verifyVisible=false">取消</el-button>
        <el-button type="primary" @click="submitVerify">完成实名（生效补贴）</el-button>
      </template>
    </el-dialog>
    <!-- 跨班组调动 -->
    <el-dialog v-model="transferVisible" title="工人跨班组调动" width="420px">
      <el-form label-width="90px">
        <el-form-item label="工人"><el-input :model-value="transferName" disabled /></el-form-item>
        <el-form-item label="调入班组">
          <el-select v-model="transferForm.teamId" style="width:100%">
            <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-alert type="warning" :closable="false" title="调动后在新班组餐点取餐记为本班组；在原班组取餐将标记为跨班组取餐。" />
      </el-form>
      <template #footer>
        <el-button @click="transferVisible=false">取消</el-button>
        <el-button type="primary" @click="submitTransfer">确认调动</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Check } from '@element-plus/icons-vue';
import api from '../api';

const date = ref(new Date().toISOString().slice(0, 10));
const teams = ref([]);
const workers = ref([]);
const attRows = ref([]);
const attMap = reactive({});
const filterTeam = ref(null);
const filterVerified = ref('');
const addVisible = ref(false);
const addForm = reactive({ name: '', teamId: null, trade: '普工', ethnicity: '汉' });
const verifyVisible = ref(false);
const verifyForm = reactive({ id: null, idCard: '', faceToken: '' });
const verifyName = ref('');
const transferVisible = ref(false);
const transferName = ref('');
const transferForm = reactive({ id: null, teamId: null });

async function loadTeams() { teams.value = await api.get('/org/teams'); if (!addForm.teamId) addForm.teamId = teams.value[0]?.id; }
async function loadWorkers() {
  const params = {};
  if (filterTeam.value) params.teamId = filterTeam.value;
  if (filterVerified.value !== '') params.verified = filterVerified.value;
  workers.value = await api.get('/org/workers', { params });
  await loadAttendance();
}
async function loadAttendance() {
  attRows.value = await api.get('/org/attendance', { params: { date: date.value } });
  for (const k of Object.keys(attMap)) delete attMap[k];
  for (const a of attRows.value) {
    if (!a.present) continue;
    attMap[a.workerId] = attMap[a.workerId] || {};
    attMap[a.workerId][a.shift] = true;
    if (a.location) attMap[a.workerId][a.shift + 'Loc'] = a.location;
  }
}

async function toggleAtt(row, shift) {
  const present = !attMap[row.id]?.[shift];
  const location = shift === 'night' ? (present ? '夜间作业区' : '') : (attMap[row.id]?.dayLoc || '');
  await api.post('/org/attendance', { date: date.value, rows: [{ workerId: row.id, shift, present, location }] });
  ElMessage.success(`${row.name} ${shift==='day'?'白班':'夜班'}已设为${present?'在岗':'缺勤'}`);
  await loadAttendance();
}
async function batchAttendance(shift) {
  const rows = workers.value.map((w) => ({ workerId: w.id, shift, present: true, location: '主体施工区' }));
  await api.post('/org/attendance', { date: date.value, rows });
  ElMessage.success(`已登记 ${rows.length} 名工人${shift==='day'?'白班':'夜班'}考勤`);
  await loadAttendance();
}

function openAdd() { Object.assign(addForm, { name: '', teamId: teams.value[0]?.id, trade: '普工', ethnicity: '汉' }); addVisible.value = true; }
async function submitAdd() {
  if (!addForm.name) return ElMessage.warning('请填写姓名');
  await api.post('/org/workers', addForm);
  ElMessage.success('工人已新增（未实名）');
  addVisible.value = false;
  await loadWorkers();
}
function openVerify(row) { Object.assign(verifyForm, { id: row.id, idCard: row.idCard || '', faceToken: row.faceToken || '' }); verifyName.value = row.name; verifyVisible.value = true; }
async function submitVerify() {
  if (!verifyForm.idCard || !verifyForm.faceToken) return ElMessage.warning('请补全身份证并采集人脸');
  await api.post(`/org/workers/${verifyForm.id}/verify`, { idCard: verifyForm.idCard, faceToken: verifyForm.faceToken });
  ElMessage.success('实名完成，自下一餐起享受个人+企业补贴');
  verifyVisible.value = false;
  await loadWorkers();
}
function openTransfer(row) {
  Object.assign(transferForm, { id: row.id, teamId: row.teamId });
  transferName.value = row.name;
  transferVisible.value = true;
}
async function submitTransfer() {
  await api.post(`/org/workers/${transferForm.id}/transfer`, { teamId: transferForm.teamId });
  ElMessage.success('调动成功');
  transferVisible.value = false;
  await loadWorkers();
}
onMounted(async () => { await loadTeams(); await loadWorkers(); });
</script>

<style scoped>
.face-collect { display:flex; flex-direction:column; align-items:center; gap:8px; padding:8px; }
</style>
