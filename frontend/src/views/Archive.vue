<template>
  <div>
    <div class="page-head">
      <div>
        <h2>月底结算与工地后勤档案</h2>
        <div class="sub">订餐、取餐、补贴、报损、投诉、留样检测、供应商扣款汇入后勤档案，用于控制浪费与保障食品安全、食堂外包考核</div>
      </div>
      <div>
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" placeholder="选择月份" @change="loadDashboard" />
        <el-button type="primary" :icon="Coin" style="margin-left:10px" @click="settle">生成/刷新月底结算档案</el-button>
      </div>
    </div>

    <el-row :gutter="14">
      <el-col :span="6" v-for="c in cards" :key="c.label">
        <el-card class="stat-card" shadow="hover">
          <div class="num" :style="{color:c.color}">{{ c.value }}<span class="unit">{{ c.unit }}</span></div>
          <div class="lbl">{{ c.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="soft-card" style="margin-top:14px">
      <div class="section-title"><el-icon><FolderOpened /></el-icon>后勤档案（全工地 + 分班组）</div>
      <el-table :data="archives" stripe>
        <el-table-column prop="month" label="月份" width="90" />
        <el-table-column prop="teamName" label="范围" min-width="120">
          <template #default="{row}">
            <el-tag :type="row.teamId===0?'danger':''" size="small" effect="plain">{{ row.teamName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="orderCount" label="订餐" width="70" align="center" />
        <el-table-column prop="pickupCount" label="取餐" width="70" align="center" />
        <el-table-column prop="wasteCount" label="浪费/报损" width="90" align="center">
          <template #default="{row}"><span :class="row.wasteCount>5?'money-up':''">{{ row.wasteCount }}</span></template>
        </el-table-column>
        <el-table-column label="取餐率" width="90" align="center">
          <template #default="{row}">{{ row.pickupRate }}%</template>
        </el-table-column>
        <el-table-column label="浪费率" width="90" align="center">
          <template #default="{row}"><span :class="row.wasteRate>=20?'money-up':''">{{ row.wasteRate }}%</span></template>
        </el-table-column>
        <el-table-column prop="complaintCount" label="投诉" width="70" align="center" />
        <el-table-column label="留样(异常)" width="100" align="center">
          <template #default="{row}">{{ row.sampleCount }} <span :class="row.sampleFailed?'money-up':''">({{ row.sampleFailed }})</span></template>
        </el-table-column>
        <el-table-column label="供应商扣款" width="110" align="center">
          <template #default="{row}"><span :class="row.supplierDeduction?'money-up':''">¥{{ row.supplierDeduction }}</span></template>
        </el-table-column>
        <el-table-column label="个人/企业补贴" width="150" align="center">
          <template #default="{row}">¥{{ row.workerSubsidyTotal }} / ¥{{ row.companySubsidyTotal }}</template>
        </el-table-column>
        <el-table-column label="工人自付" width="90" align="center">
          <template #default="{row}">¥{{ row.selfPayTotal }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{row}">
            <el-tag size="small" :type="row.settled?'success':'info'">{{ row.settled?'已结算':'草稿' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-row :gutter="14" style="margin-top:14px">
      <el-col :span="12">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><Warning /></el-icon>投诉类型与食品安全</div>
          <el-table :data="ov.complaintTypes || []" size="small" stripe>
            <el-table-column prop="label" label="投诉/异常类型" />
            <el-table-column prop="count" label="数量" width="90" align="center" />
          </el-table>
          <el-descriptions :column="2" border size="small" style="margin-top:12px">
            <el-descriptions-item label="留样总数">{{ ov.sampleCount }}</el-descriptions-item>
            <el-descriptions-item label="留样中">{{ ov.sampleRetained }}</el-descriptions-item>
            <el-descriptions-item label="检测合格">{{ ov.samplePassed }}</el-descriptions-item>
            <el-descriptions-item label="检测异常"><span class="money-up">{{ ov.sampleFailed }}</span></el-descriptions-item>
            <el-descriptions-item label="未实名取餐">{{ ov.unverifiedPickups }} 人次</el-descriptions-item>
            <el-descriptions-item label="跨班组取餐">{{ ov.crossTeamPickups }} 人次</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><Management /></el-icon>外包考核与浪费管控建议</div>
          <el-alert type="warning" :closable="false" style="margin-bottom:10px"
            :title="`食堂外包：本月供应商扣款合计已计入档案；取餐率低于 70% 的班组建议下调订餐量，浪费率高于 20% 的菜品建议调整菜单。`" />
          <el-table :data="ovTeams" size="small" stripe>
            <el-table-column prop="teamName" label="班组" />
            <el-table-column label="取餐率"><template #default="{row}">{{ row.pickupRate }}%</template></el-table-column>
            <el-table-column label="浪费率"><template #default="{row}"><span :class="row.wasteRate>=20?'money-up':''">{{ row.wasteRate }}%</span></template></el-table-column>
            <el-table-column label="管控建议" min-width="150">
              <template #default="{row}">
                <el-tag size="small" :type="row.wasteRate>=20?'danger':row.pickupRate<70?'warning':'success'">
                  {{ row.wasteRate>=20 ? '减少备餐/调菜单' : row.pickupRate<70 ? '核减订餐' : '保持' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Coin } from '@element-plus/icons-vue';
import api from '../api';

const month = ref(new Date().toISOString().slice(0, 7));
const ov = reactive({});
const ovTeams = ref([]);
const archives = ref([]);

const cards = computed(() => [
  { label: '订餐总份数', value: ov.orderCount ?? 0, unit: '份', color: '#1f6f54' },
  { label: '实际取餐 / 取餐率', value: `${ov.pickupCount ?? 0}`, unit: `${ov.pickupRate ?? 0}%`, color: '#2f7ed8' },
  { label: '浪费/报损 / 浪费率', value: ov.wasteCount ?? 0, unit: `${ov.wasteRate ?? 0}%`, color: '#c45656' },
  { label: '补贴合计(个人+企业)', value: (Number(ov.workerSubsidyTotal||0)+Number(ov.companySubsidyTotal||0)).toFixed(0), unit: '元', color: '#1f6f54' },
]);

async function loadDashboard() {
  const d = await api.get('/stats/dashboard', { params: { month: month.value } });
  Object.assign(ov, d.overview);
  ov.complaintTypes = d.complaintTypes;
  ovTeams.value = d.teams;
  await loadArchives();
}
async function loadArchives() {
  archives.value = await api.get('/stats/archives', { params: { month: month.value } });
}
async function settle() {
  const rows = await api.post('/stats/settle', { month: month.value });
  ElMessage.success(`已生成 ${rows.length} 条结算档案（全工地 + ${rows.length-1} 个班组）`);
  await loadArchives();
}
onMounted(loadDashboard);
</script>

<style scoped>
.unit { font-size:13px; font-weight:400; margin-left:4px; color:#90a09c; }
</style>
