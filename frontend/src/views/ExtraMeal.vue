<template>
  <div>
    <div class="page-head">
      <div>
        <h2>夜间加班临时加餐</h2>
        <div class="sub">混凝土浇筑到深夜等临时安排：班组长发起，平台检查食堂值班、食材余量、配送点与餐补规则；高风险作业区由安全员确认路线与停留时间，多施工点分别签收（签收人/温度/剩余/照片），费用与领取人员归入夜宵餐次</div>
      </div>
      <div>
        <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false" @change="load" />
        <el-button type="primary" :icon="Moon" style="margin-left:10px" @click="openCreate">发起夜间加餐</el-button>
      </div>
    </div>

    <!-- 加餐单列表 -->
    <div v-if="!list.length" class="empty">
      <el-empty description="该日期暂无夜间加餐；点击右上角「发起夜间加餐」" />
    </div>

    <el-card v-for="e in list" :key="e.id" class="soft-card" style="margin-bottom:16px">
      <template #header>
        <div class="ex-head">
          <div>
            <el-tag :type="statusType(e.status)" effect="dark" size="small">{{ statusName(e.status) }}</el-tag>
            <el-tag v-if="e.highRisk" type="danger" effect="plain" size="small" style="margin-left:8px"><el-icon><Warning /></el-icon> 含高风险作业区</el-tag>
            <b style="margin-left:10px">{{ e.menu || '夜间加餐' }}</b>
            <span class="muted" style="margin-left:10px">{{ e.date }} 夜宵 · 发起人 {{ e.requester?.name }}</span>
          </div>
          <div class="ex-actions">
            <el-button v-if="e.status==='pending_safety'" type="danger" size="small" :icon="CircleCheck" @click="openSafety(e)">安全员确认路线/停留</el-button>
            <el-button v-if="e.status==='ready'" type="warning" size="small" :icon="Bowl" @click="canteenConfirm(e)">食堂确认备餐（扣余量）</el-button>
          </div>
        </div>
      </template>

      <el-alert :title="e.reason" type="info" :closable="false" style="margin-bottom:10px" />

      <!-- 汇总 -->
      <el-descriptions :column="5" border size="small" style="margin-bottom:12px">
        <el-descriptions-item label="确认份数">{{ e.confirmedCount }}</el-descriptions-item>
        <el-descriptions-item label="已送达">{{ e.sentTotal }}</el-descriptions-item>
        <el-descriptions-item label="已签收/领取">{{ e.receivedTotal }} / {{ e.pickupTotal }} 人次</el-descriptions-item>
        <el-descriptions-item label="剩余（漏领预警）">
          <span :class="e.remainingTotal ? 'money-up' : ''">{{ e.remainingTotal }} 份</span>
        </el-descriptions-item>
        <el-descriptions-item label="费用（企业承担/自付）">¥{{ e.money.company }} / ¥{{ e.money.self }}</el-descriptions-item>
      </el-descriptions>

      <el-alert v-if="e.safetyNote" type="error" :closable="false" style="margin-bottom:10px" :title="'安全员：' + e.safetyNote" />

      <!-- 漏领预警 -->
      <el-alert v-for="m in missedMap[e.id] || []" :key="m.id" type="warning" :closable="false" style="margin-bottom:8px"
        :title="`漏领预警：${m.pointName} 仍剩 ${m.remaining} 份（签收人 ${m.receiver || '—'}），请通知对应班组领取，防止漏领`" />

      <!-- 多施工点 -->
      <el-table :data="e.points" size="small" border style="margin-bottom:12px">
        <el-table-column label="施工点 / 路线" min-width="200">
          <template #default="{row}">
            <b>{{ row.pointName }}</b>
            <el-tag v-if="isHighRisk(row.pointName)" size="small" type="danger" effect="plain" style="margin-left:4px">高风险</el-tag>
            <div class="muted" style="font-size:12px">{{ row.route || '路线待登记' }}<span v-if="row.stayMinutes"> · 停留 {{ row.stayMinutes }} 分钟</span></div>
          </template>
        </el-table-column>
        <el-table-column label="送达/签收/剩余" width="150" align="center">
          <template #default="{row}">
            {{ row.sentCount }} / <span :class="row.sentCount-row.receivedCount?'':''">{{ row.receivedCount }}</span>
            / <span :class="(row.sentCount-row.receivedCount)>0?'money-up':''">{{ row.sentCount - row.receivedCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="签收人" width="110">
          <template #default="{row}">{{ row.receiver || '—' }}</template>
        </el-table-column>
        <el-table-column label="温度℃" width="80" align="center">
          <template #default="{row}">
            <el-tag v-if="row.temp" :type="Number(row.temp)>=55?'success':'warning'" size="small">{{ row.temp }}</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="送达照片" width="80" align="center">
          <template #default="{row}">
            <el-image v-if="row.photo" :src="row.photo" style="width:44px;height:30px;border-radius:4px"
              :preview-src-list="[row.photo]" fit="cover" preview-teleported />
            <span v-else class="muted">无</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{row}">
            <el-tag size="small" :type="pointStatusType(row.status)">{{ pointStatusName(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{row}">
            <el-button size="small" link type="primary" :disabled="e.status==='pending_safety'" @click="openDepart(e,row)">出发</el-button>
            <el-button size="small" link type="success" :disabled="row.status==='pending'" @click="openReceive(e,row)">签收+照片</el-button>
            <el-button size="small" link type="warning" @click="openPickup(e,row)">领取</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 领取人员 -->
      <el-collapse>
        <el-collapse-item :title="`领取人员明细（${e.pickups?.length || 0} 人次，已归入夜宵餐次）`" :name="e.id">
          <el-table :data="e.pickups || []" size="small" stripe max-height="240">
            <el-table-column label="工人" min-width="100"><template #default="{row}">{{ row.worker?.name }}</template></el-table-column>
            <el-table-column label="班组" min-width="100"><template #default="{row}">{{ row.team?.name }}</template></el-table-column>
            <el-table-column label="领取点" min-width="140"><template #default="{row}">{{ row.point?.pointName || '—' }}</template></el-table-column>
            <el-table-column label="方式" width="70"><template #default="{row}">{{ row.method==='face'?'刷脸':'扫码' }}</template></el-table-column>
            <el-table-column label="餐标" width="70" align="center"><template #default="{row}">¥{{ row.price }}</template></el-table-column>
            <el-table-column label="企业补贴" width="90" align="center"><template #default="{row}">¥{{ row.companySubsidy }}</template></el-table-column>
            <el-table-column label="个人自付" width="90" align="center"><template #default="{row}">¥{{ row.selfPay }}</template></el-table-column>
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <!-- 发起加餐 -->
    <el-dialog v-model="createVisible" title="发起夜间加班临时加餐" width="680px">
      <el-form label-width="96px">
        <el-form-item label="夜宵餐次">
          <el-select v-model="form.sessionId" placeholder="选择当夜宵餐次" style="width:100%">
            <el-option v-for="s in midnightSessions" :key="s.id" :label="`${s.date} 夜宵（${s.status}）`" :value="s.id" />
          </el-select>
          <div class="muted" style="font-size:12px">加餐归入该夜宵餐次；如无夜宵餐次，请先在订餐页新建。</div>
        </el-form-item>
        <el-form-item label="加餐事由"><el-input v-model="form.reason" placeholder="如：2#楼混凝土浇筑到深夜" /></el-form-item>
        <el-form-item label="菜单"><el-input v-model="form.menu" placeholder="热粥、肉包、卤蛋" /></el-form-item>
        <el-form-item label="申请份数"><el-input-number v-model="form.requestedCount" :min="1" /></el-form-item>

        <el-divider content-position="left">送达施工点（多个点分别签收，防止漏领）</el-divider>
        <div v-for="(p, i) in form.points" :key="i" class="point-row">
          <el-input v-model="p.pointName" placeholder="施工点，如 2#塔吊底部安全平台 / 夜间浇筑区" style="width:260px" />
          <el-select v-model="p.teamId" placeholder="班组" clearable style="width:150px">
            <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
          <el-input-number v-model="p.sentCount" :min="0" placeholder="份数" controls-position="right" style="width:120px" />
          <el-button link type="danger" @click="form.points.splice(i,1)">删除</el-button>
        </div>
        <el-button size="small" :icon="Plus" @click="form.points.push({ pointName:'', teamId:null, sentCount:0 })">增加配送点</el-button>

        <!-- 四项检查 -->
        <el-divider content-position="left">发起前检查</el-divider>
        <el-button type="primary" plain :loading="checking" @click="runPrecheck">检查食堂值班 / 食材余量 / 配送点 / 餐补规则</el-button>
        <div v-if="check" style="margin-top:10px">
          <el-alert v-for="c in check.checks" :key="c.key" :title="`${c.label}：${c.msg}`"
            :type="c.pass ? 'success' : 'error'" :closable="false" style="margin-bottom:6px" show-icon />
          <el-alert v-if="check.highRisk" type="warning" :closable="false" show-icon
            title="配送点含高风险作业区（塔吊/高空/封闭/深基坑等），提交后必须由安全员确认送餐路线与停留时间方可备餐。" />
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createVisible=false">取消</el-button>
        <el-button type="primary" :disabled="!(check && check.pass)" @click="submitCreate">确认发起加餐</el-button>
      </template>
    </el-dialog>

    <!-- 安全员确认 -->
    <el-dialog v-model="safetyVisible" title="安全员确认高风险送餐" width="560px">
      <el-alert type="error" :closable="false" style="margin-bottom:10px" title="配送点位于高风险作业区，请确认送餐路线与停留时间" />
      <div v-for="p in safetyPoints" :key="p.id" class="point-row" style="margin-bottom:10px">
        <div style="width:100%">
          <b>{{ p.pointName }}</b>
          <el-input v-model="p.route" placeholder="送餐路线" style="margin-top:4px" />
          <el-input-number v-model="p.stayMinutes" :min="1" placeholder="停留分钟" controls-position="right" style="margin-top:6px" />
          <span class="muted">分钟（限制在高风险区停留时长）</span>
        </div>
      </div>
      <el-input v-model="safetyNote" type="textarea" :rows="2" placeholder="安全确认意见（警戒、安全帽、封闭区登记等）" />
      <template #footer>
        <el-button @click="safetyVisible=false">取消</el-button>
        <el-button type="danger" @click="submitSafety">安全员确认通过</el-button>
      </template>
    </el-dialog>

    <!-- 出发 -->
    <el-dialog v-model="departVisible" title="配送出发" width="440px">
      <el-form label-width="84px">
        <el-form-item label="施工点"><b>{{ departRow.pointName }}</b></el-form-item>
        <el-form-item label="送餐路线"><el-input v-model="departRow.route" /></el-form-item>
        <el-form-item label="停留(分钟)"><el-input-number v-model="departRow.stayMinutes" :min="1" /></el-form-item>
        <el-form-item label="送达份数"><el-input-number v-model="departRow.sentCount" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="departVisible=false">取消</el-button>
        <el-button type="primary" @click="submitDepart">确认出发</el-button>
      </template>
    </el-dialog>

    <!-- 签收 + 照片 -->
    <el-dialog v-model="receiveVisible" title="施工点签收（签收人/温度/剩余/照片）" width="480px">
      <el-form label-width="90px">
        <el-form-item label="施工点"><b>{{ receiveRow.pointName }}</b>（送达 {{ receiveRow.sentCount }} 份）</el-form-item>
        <el-form-item label="签收人"><el-input v-model="receiveRow.receiver" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="receiveRow.receiverPhone" /></el-form-item>
        <el-form-item label="餐食温度℃"><el-input-number v-model="receiveRow.temp" :min="0" :precision="1" /></el-form-item>
        <el-form-item label="已签收份数">
          <el-input-number v-model="receiveRow.receivedCount" :min="0" :max="receiveRow.sentCount" />
          <span class="muted">剩余 {{ receiveRow.sentCount - (receiveRow.receivedCount||0) }} 份将触发漏领预警</span>
        </el-form-item>
        <el-form-item label="送达照片">
          <input type="file" accept="image/*" capture="environment" @change="onPhoto" />
          <el-image v-if="receiveRow.photo" :src="receiveRow.photo" style="width:160px;margin-top:8px;border-radius:6px" fit="cover" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="receiveVisible=false">取消</el-button>
        <el-button type="success" @click="submitReceive">确认签收</el-button>
      </template>
    </el-dialog>

    <!-- 领取 -->
    <el-dialog v-model="pickupVisible" title="工人领取加餐" width="440px">
      <el-alert type="success" :closable="false" style="margin-bottom:10px" :title="`${pickupContext.pointName}｜夜间加班加餐企业全额承担，个人 0 元`" />
      <el-radio-group v-model="pickupMethod" style="margin-bottom:10px">
        <el-radio-button label="face">刷脸</el-radio-button>
        <el-radio-button label="code">扫码</el-radio-button>
      </el-radio-group>
      <el-select v-if="pickupMethod==='face'" v-model="pickupWorker" filterable placeholder="选择工人（模拟刷脸）" style="width:100%">
        <el-option v-for="w in workers" :key="w.id" :label="`${w.name}｜${w.team?.name}｜${w.verified?'已实名':'未实名'}`" :value="w.id" />
      </el-select>
      <el-input v-else v-model="pickupCode" placeholder="取餐码，如 P1001" @keyup.enter="submitPickup" />
      <template #footer>
        <el-button @click="pickupVisible=false">关闭</el-button>
        <el-button type="primary" @click="submitPickup">确认领取</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Moon, Plus, Warning, CircleCheck, Bowl } from '@element-plus/icons-vue';
import api from '../api';

const date = ref(new Date().toISOString().slice(0, 10));
const list = ref([]);
const teams = ref([]);
const workers = ref([]);
const midnightSessions = ref([]);
const missedMap = reactive({});

const STATUS = {
  pending_safety: '待安全员确认', ready: '待食堂备餐', confirmed: '已备餐/待配送',
  delivering: '配送中', received: '已签收', closed: '已关闭',
};
const statusName = (s) => STATUS[s] || s;
const statusType = (s) => ({ pending_safety: 'danger', ready: 'info', confirmed: 'warning', delivering: 'primary', received: 'success', closed: '' }[s] || '');
const pointStatusName = (s) => ({ pending: '待出发', delivered: '已送达', received: '已签收' }[s] || s);
const pointStatusType = (s) => ({ pending: 'info', delivered: 'primary', received: 'success' }[s] || '');
const HIGH = ['塔吊', '高空', '封闭', '深基坑', '吊装', '屋面', '临边', '洞口', '电梯井', '外架'];
const isHighRisk = (t) => HIGH.some((k) => (t || '').includes(k));

async function load() {
  list.value = await api.get('/extra-meals', { params: { date: date.value } });
  midnightSessions.value = (await api.get('/meals/sessions', { params: { date: date.value } })).filter((s) => s.shift === 'midnight');
  for (const e of list.value) {
    const d = await api.get(`/extra-meals/${e.id}`);
    const idx = list.value.findIndex((x) => x.id === e.id);
    list.value[idx] = d;
    missedMap[e.id] = d.missedPoints || [];
  }
}

// ---- 发起 ----
const createVisible = ref(false);
const checking = ref(false);
const check = ref(null);
const form = reactive({ sessionId: null, reason: '', menu: '夜班加餐：热粥、肉包、卤蛋', requestedCount: 8, points: [{ pointName: '', teamId: null, sentCount: 0 }] });
async function openCreate() {
  Object.assign(form, { sessionId: midnightSessions.value[0]?.id || null, reason: '项目部临时安排混凝土浇筑到深夜，作业人员需加餐', menu: '夜班加餐：热粥、肉包、卤蛋', requestedCount: 8, points: [{ pointName: '', teamId: null, sentCount: 0 }] });
  check.value = null;
  createVisible.value = true;
}
async function runPrecheck() {
  if (!form.sessionId) return ElMessage.warning('请选择夜宵餐次');
  if (!form.points.filter((p) => p.pointName).length) return ElMessage.warning('请至少填写一个配送施工点');
  checking.value = true;
  try {
    check.value = await api.post('/extra-meals/precheck', {
      sessionId: form.sessionId, requestedCount: form.requestedCount,
      pointNames: form.points.map((p) => p.pointName),
    });
    if (!check.value.pass) ElMessage.error('检查未通过，请按提示处理后再发起');
    else ElMessage.success('四项检查通过，可确认发起');
  } finally { checking.value = false; }
}
async function submitCreate() {
  await api.post('/extra-meals', {
    sessionId: form.sessionId, reason: form.reason, requestedCount: form.requestedCount, menu: form.menu,
    points: form.points.filter((p) => p.pointName).map((p) => ({ pointName: p.pointName, teamId: p.teamId, sentCount: p.sentCount || undefined })),
  });
  ElMessage.success('加餐已发起');
  createVisible.value = false;
  await load();
}

// ---- 安全员 ----
const safetyVisible = ref(false);
const safetyId = ref(null);
const safetyPoints = ref([]);
const safetyNote = ref('');
function openSafety(e) {
  safetyId.value = e.id;
  safetyPoints.value = (e.points || []).map((p) => ({ id: p.id, route: p.route || '', stayMinutes: p.stayMinutes ?? 8 }));
  safetyNote.value = e.safetyNote || '已确认送餐路线与停留时间：设高空警戒、佩戴安全帽、封闭区登记，限时停留';
  safetyVisible.value = true;
}
async function submitSafety() {
  await api.post(`/extra-meals/${safetyId.value}/safety`, {
    safetyNote: safetyNote.value,
    points: safetyPoints.value.map((p) => ({ id: p.id, route: p.route, stayMinutes: p.stayMinutes })),
  });
  ElMessage.success('安全员已确认，可通知食堂备餐');
  safetyVisible.value = false; await load();
}

// ---- 食堂备餐 ----
async function canteenConfirm(e) {
  await api.post(`/extra-meals/${e.id}/canteen-confirm`);
  ElMessage.success('食堂已备餐并扣减食材余量'); await load();
}

// ---- 出发 ----
const departVisible = ref(false);
const departExtraId = ref(null);
const departRow = reactive({ id: null, pointName: '', route: '', stayMinutes: 8, sentCount: 0 });
function openDepart(e, row) {
  departExtraId.value = e.id;
  Object.assign(departRow, { id: row.id, pointName: row.pointName, route: row.route || '', stayMinutes: row.stayMinutes ?? 8, sentCount: row.sentCount });
  departVisible.value = true;
}
async function submitDepart() {
  await api.post(`/extra-meals/points/${departRow.id}/depart`, {
    route: departRow.route, stayMinutes: departRow.stayMinutes, sentCount: departRow.sentCount,
  });
  ElMessage.success('已登记出发'); departVisible.value = false; await load();
}

// ---- 签收 + 照片 ----
const receiveVisible = ref(false);
const receiveRow = reactive({ id: null, pointName: '', sentCount: 0, receiver: '', receiverPhone: '', temp: 60, receivedCount: 0, photo: '' });
function openReceive(e, row) {
  Object.assign(receiveRow, { id: row.id, pointName: row.pointName, sentCount: row.sentCount, receiver: row.receiver || '', receiverPhone: row.receiverPhone || '', temp: row.temp ?? 60, receivedCount: row.receivedCount || row.sentCount, photo: row.photo || '' });
  receiveVisible.value = true;
}
function onPhoto(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    // 压缩到宽 480，避免照片过大
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 480 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      receiveRow.photo = canvas.toDataURL('image/jpeg', 0.7);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
async function submitReceive() {
  if (!receiveRow.receiver) return ElMessage.warning('请填写签收人');
  await api.post(`/extra-meals/points/${receiveRow.id}/receive`, {
    receiver: receiveRow.receiver, receiverPhone: receiveRow.receiverPhone, temp: receiveRow.temp,
    receivedCount: receiveRow.receivedCount, photo: receiveRow.photo,
  });
  ElMessage.success('签收完成'); receiveVisible.value = false; await load();
}

// ---- 领取 ----
const pickupVisible = ref(false);
const pickupExtraId = ref(null);
const pickupContext = reactive({ pointName: '' });
const pickupPointId = ref(null);
const pickupMethod = ref('face');
const pickupWorker = ref(null);
const pickupCode = ref('');
function openPickup(e, row) {
  pickupExtraId.value = e.id; pickupPointId.value = row.id;
  pickupContext.pointName = row.pointName;
  pickupWorker.value = null; pickupCode.value = ''; pickupMethod.value = 'face';
  pickupVisible.value = true;
}
async function submitPickup() {
  const payload = { extraMealId: pickupExtraId.value, pointId: pickupPointId.value, method: pickupMethod.value };
  if (pickupMethod.value === 'face') { if (!pickupWorker.value) return ElMessage.warning('请选择工人'); payload.workerId = pickupWorker.value; }
  else { if (!pickupCode.value) return ElMessage.warning('请输入取餐码'); payload.code = pickupCode.value.trim(); }
  const r = await api.post('/extra-meals/pickup', payload);
  ElMessage.success(`${r.worker.name} 领取成功，企业承担 ¥${r.companySubsidy}，自付 ¥${r.selfPay}`);
  pickupVisible.value = false; await load();
}

onMounted(async () => {
  teams.value = await api.get('/org/teams');
  workers.value = await api.get('/org/workers');
  await load();
});
</script>

<style scoped>
.empty { background:#fff; border-radius:12px; padding:30px; }
.ex-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
.point-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
</style>
