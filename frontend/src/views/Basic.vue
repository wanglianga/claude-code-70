<template>
  <div>
    <div class="page-head">
      <div>
        <h2>基础档案</h2>
        <div class="sub">食堂（含外包考核）、供应商、班组、项目部临时接待等后勤基础数据维护</div>
      </div>
    </div>

    <el-tabs v-model="tab">
      <!-- 食堂 -->
      <el-tab-pane label="食堂管理" name="canteen">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><OfficeBuilding /></el-icon>食堂（支持自营/外包）
            <el-button size="small" type="primary" :icon="Plus" style="margin-left:auto" @click="openCanteen">新增食堂</el-button>
          </div>
          <el-table :data="canteens" stripe>
            <el-table-column prop="name" label="食堂名称" min-width="220" />
            <el-table-column label="经营方式" width="110">
              <template #default="{row}">
                <el-tag :type="row.outsourced?'warning':'success'" size="small">{{ row.outsourced?'外包':'自营' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="capacity" label="单餐产能(份)" width="120" align="center" />
            <el-table-column prop="manager" label="负责人" width="110" />
            <el-table-column prop="phone" label="电话" width="130" />
            <el-table-column label="外包考核分" width="110" align="center">
              <template #default="{row}">
                <el-tag :type="row.vendorScore>=85?'success':row.vendorScore>=70?'warning':'danger'" size="small">{{ row.vendorScore }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="供应商数" width="90" align="center">
              <template #default="{row}">{{ row.suppliers?.length || 0 }}</template>
            </el-table-column>
            <el-table-column label="夜宵值班/食材余量" width="150" align="center">
              <template #default="{row}">
                <el-tag size="small" :type="row.nightDuty?'success':'danger'">{{ row.nightDuty ? '值班' : '未值班' }}</el-tag>
                <div class="muted" style="font-size:12px">余量 {{ row.ingredientStock ?? 0 }} 份</div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{row}">
                <el-button size="small" link type="primary" @click="editCapacity(row)">改产能</el-button>
                <el-button size="small" link type="warning" @click="editNight(row)">夜宵值班/余量</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card class="soft-card" style="margin-top:14px">
          <div class="section-title"><el-icon><Connection /></el-icon>供应商档案（扣款随留样异常/投诉累计）
            <el-button size="small" type="primary" :icon="Plus" style="margin-left:auto" @click="openSupplier">新增供应商</el-button>
          </div>
          <el-table :data="suppliers" stripe>
            <el-table-column prop="name" label="供应商" min-width="160" />
            <el-table-column prop="contact" label="联系人" width="100" />
            <el-table-column prop="phone" label="电话" width="130" />
            <el-table-column prop="licenseNo" label="经营许可证" width="140" />
            <el-table-column label="累计扣款" width="110" align="center">
              <template #default="{row}"><span :class="row.deduction?'money-up':''">¥{{ row.deduction }}</span></template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 班组 -->
      <el-tab-pane label="班组与施工计划" name="team">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><User /></el-icon>班组（宿舍人数用于订餐校验）
            <el-button size="small" type="primary" :icon="Plus" style="margin-left:auto" @click="openTeam">新增班组</el-button>
          </div>
          <el-table :data="teamDetails" stripe>
            <el-table-column prop="name" label="班组" min-width="130" />
            <el-table-column prop="trade" label="主要工种" width="120" />
            <el-table-column prop="dormHeadcount" label="宿舍登记人数" width="120" align="center" />
            <el-table-column prop="workerCount" label="在册工人" width="100" align="center" />
            <el-table-column label="已实名" width="100" align="center">
              <template #default="{row}">{{ row.verifiedCount }} / {{ row.workerCount }}</template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{row}">
                <el-button size="small" link type="primary" @click="editDorm(row)">改宿舍人数</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 临时接待 -->
      <el-tab-pane label="项目部临时接待" name="reception">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><Coffee /></el-icon>项目部临时接待用餐（走异常协同，财务单独核算）</div>
          <el-alert type="info" :closable="false" style="margin-bottom:12px"
            title="临时接待不占用工人餐补：项目部在「异常协同」发起 RECEPTION 工单，协同食堂加备、财务按接待标准结算。可在此快速发起。" />
          <el-form :model="reception" label-width="110px" style="max-width:560px">
            <el-form-item label="接待日期餐次">
              <el-date-picker v-model="reception.date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
            <el-form-item label="接待人数"><el-input-number v-model="reception.count" :min="1" /></el-form-item>
            <el-form-item label="接待标准(元/人)"><el-input-number v-model="reception.price" :min="0" /></el-form-item>
            <el-form-item label="事由"><el-input v-model="reception.reason" placeholder="如：上级安全检查接待、甲方验收" /></el-form-item>
            <el-button type="primary" @click="submitReception">发起临时接待工单</el-button>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 弹窗 -->
    <el-dialog v-model="canteenVisible" title="新增食堂" width="460px">
      <el-form :model="canteenForm" label-width="92px">
        <el-form-item label="名称"><el-input v-model="canteenForm.name" /></el-form-item>
        <el-form-item label="经营方式">
          <el-switch v-model="canteenForm.outsourced" active-text="外包" inactive-text="自营" />
        </el-form-item>
        <el-form-item label="单餐产能"><el-input-number v-model="canteenForm.capacity" :min="1" /></el-form-item>
        <el-form-item label="负责人"><el-input v-model="canteenForm.manager" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="canteenForm.phone" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="canteenVisible=false">取消</el-button>
        <el-button type="primary" @click="submitCanteen">保存</el-button>
      </template>
    </el-dialog>

    <!-- 夜宵值班 / 食材余量 -->
    <el-dialog v-model="nightVisible" title="夜宵值班与食材余量（加餐检查依赖）" width="460px">
      <el-form :model="nightForm" label-width="110px">
        <el-form-item label="夜宵值班">
          <el-switch v-model="nightForm.nightDuty" active-text="已安排值班" inactive-text="未值班" />
        </el-form-item>
        <el-form-item label="值班厨师"><el-input v-model="nightForm.nightDutyChef" /></el-form-item>
        <el-form-item label="值班电话"><el-input v-model="nightForm.nightDutyPhone" /></el-form-item>
        <el-form-item label="食材余量(份)"><el-input-number v-model="nightForm.ingredientStock" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="nightVisible=false">取消</el-button>
        <el-button type="primary" @click="submitNight">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="supplierVisible" title="新增供应商" width="460px">
      <el-form :model="supplierForm" label-width="92px">
        <el-form-item label="名称"><el-input v-model="supplierForm.name" /></el-form-item>
        <el-form-item label="所属食堂">
          <el-select v-model="supplierForm.canteenId" style="width:100%">
            <el-option v-for="c in canteens" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人"><el-input v-model="supplierForm.contact" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="supplierForm.phone" /></el-form-item>
        <el-form-item label="许可证号"><el-input v-model="supplierForm.licenseNo" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="supplierVisible=false">取消</el-button>
        <el-button type="primary" @click="submitSupplier">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="teamVisible" title="新增班组" width="420px">
      <el-form :model="teamForm" label-width="100px">
        <el-form-item label="班组名称"><el-input v-model="teamForm.name" /></el-form-item>
        <el-form-item label="主要工种"><el-input v-model="teamForm.trade" /></el-form-item>
        <el-form-item label="宿舍人数"><el-input-number v-model="teamForm.dormHeadcount" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="teamVisible=false">取消</el-button>
        <el-button type="primary" @click="submitTeam">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../api';

const tab = ref('canteen');
const canteens = ref([]);
const suppliers = ref([]);
const teamDetails = ref([]);

const canteenVisible = ref(false);
const canteenForm = reactive({ name: '', outsourced: true, capacity: 200, manager: '', phone: '' });
const nightVisible = ref(false);
const nightForm = reactive({ id: null, nightDuty: false, nightDutyChef: '', nightDutyPhone: '', ingredientStock: 0 });
const supplierVisible = ref(false);
const supplierForm = reactive({ name: '', canteenId: null, contact: '', phone: '', licenseNo: '' });
const teamVisible = ref(false);
const teamForm = reactive({ name: '', trade: '', dormHeadcount: 20 });
const reception = reactive({ date: new Date().toISOString().slice(0, 10), count: 8, price: 30, reason: '' });

async function load() {
  canteens.value = await api.get('/org/canteens');
  suppliers.value = await api.get('/org/suppliers');
  const teams = await api.get('/org/teams');
  teamDetails.value = await Promise.all(teams.map((t) => api.get(`/org/teams/${t.id}`)));
}
function openCanteen() { Object.assign(canteenForm, { name: '', outsourced: true, capacity: 200, manager: '', phone: '' }); canteenVisible.value = true; }
async function submitCanteen() {
  if (!canteenForm.name) return ElMessage.warning('请填写名称');
  await api.post('/org/canteens', canteenForm);
  ElMessage.success('食堂已新增'); canteenVisible.value = false; load();
}
function openSupplier() { Object.assign(supplierForm, { name: '', canteenId: canteens.value[0]?.id, contact: '', phone: '', licenseNo: '' }); supplierVisible.value = true; }
async function submitSupplier() {
  if (!supplierForm.name) return ElMessage.warning('请填写名称');
  await api.post('/org/suppliers', supplierForm);
  ElMessage.success('供应商已新增'); supplierVisible.value = false; load();
}
function openTeam() { Object.assign(teamForm, { name: '', trade: '', dormHeadcount: 20 }); teamVisible.value = true; }
async function submitTeam() {
  if (!teamForm.name) return ElMessage.warning('请填写名称');
  await api.post('/org/teams', teamForm);
  ElMessage.success('班组已新增'); teamVisible.value = false; load();
}
async function submitReception() {
  if (!reception.reason) return ElMessage.warning('请填写接待事由');
  await api.post('/incidents', {
    type: 'RECEPTION',
    title: `项目部临时接待 ${reception.count} 人`,
    description: `${reception.date} 临时接待：${reception.count} 人，标准 ¥${reception.price}/人，事由：${reception.reason}。请食堂加备、财务按接待单独核算，不计入工人餐补。`,
    severity: 'low',
  });
  ElMessage.success('临时接待工单已发起（食堂/财务协同）');
}

// ---- 改产能 / 改宿舍人数（用于验证订餐生成的业务约束） ----
async function editCapacity(row) {
  const { value } = await ElMessageBox.prompt(`设置「${row.name}」单餐产能（份）`, '调整食堂产能', {
    inputValue: String(row.capacity), inputPattern: /^\d+$/, inputErrorMessage: '请输入非负整数',
  }).catch(() => ({ value: null }));
  if (value === null || value === undefined) return;
  await api.patch(`/org/canteens/${row.id}`, { capacity: +value });
  ElMessage.success(`食堂产能已改为 ${value}，重新生成订餐即按新产能硬约束分配`);
  await load();
}
async function editDorm(row) {
  const { value } = await ElMessageBox.prompt(`设置「${row.name}」宿舍登记人数（0=不限制）`, '调整宿舍人数', {
    inputValue: String(row.dormHeadcount), inputPattern: /^\d+$/, inputErrorMessage: '请输入非负整数',
  }).catch(() => ({ value: null }));
  if (value === null || value === undefined) return;
  await api.patch(`/org/teams/${row.id}`, { dormHeadcount: +value });
  ElMessage.success(`宿舍人数已改为 ${value}，重新生成订餐时将封顶/放宽该班组需求`);
  await load();
}

// ---- 夜宵值班 / 食材余量 ----
function editNight(row) {
  Object.assign(nightForm, {
    id: row.id, nightDuty: !!row.nightDuty,
    nightDutyChef: row.nightDutyChef || '', nightDutyPhone: row.nightDutyPhone || '',
    ingredientStock: row.ingredientStock ?? 0,
  });
  nightVisible.value = true;
}
async function submitNight() {
  await api.patch(`/org/canteens/${nightForm.id}`, {
    nightDuty: nightForm.nightDuty, nightDutyChef: nightForm.nightDutyChef,
    nightDutyPhone: nightForm.nightDutyPhone, ingredientStock: nightForm.ingredientStock,
  });
  ElMessage.success(nightForm.nightDuty ? '夜宵值班已开启，余量已更新' : '夜宵值班已关闭');
  nightVisible.value = false; await load();
}

onMounted(load);
</script>
