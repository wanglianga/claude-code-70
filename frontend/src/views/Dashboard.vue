<template>
  <div>
    <div class="page-head">
      <div>
        <h2>管理看板</h2>
        <div class="sub">按餐次/月度汇总：取餐率、浪费率、投诉类型、补贴与食品安全，用于调整菜单、补贴比例与食堂外包考核</div>
      </div>
      <el-date-picker v-model="month" type="month" value-format="YYYY-MM" placeholder="选择月份"
        @change="load" clearable />
    </div>

    <!-- KPI -->
    <el-row :gutter="14">
      <el-col :span="6" v-for="k in kpis" :key="k.label">
        <el-card class="stat-card" shadow="hover">
          <div class="num" :style="{ color: k.color }">{{ k.value }}<span class="unit">{{ k.unit }}</span></div>
          <div class="lbl">{{ k.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="14" style="margin-top:14px">
      <el-col :span="6" v-for="k in kpis2" :key="k.label">
        <el-card class="stat-card" shadow="hover">
          <div class="num" :style="{ color: k.color }">{{ k.value }}<span class="unit">{{ k.unit }}</span></div>
          <div class="lbl">{{ k.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="14" style="margin-top:14px">
      <el-col :span="14">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><Histogram /></el-icon>各班组取餐率 vs 浪费率（%）</div>
          <div ref="chartTeam" style="height:320px"></div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><PieChart /></el-icon>投诉/异常类型分布</div>
          <div ref="chartComplaint" style="height:320px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="14" style="margin-top:14px">
      <el-col :span="12">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><Wallet /></el-icon>餐费构成（元）</div>
          <div ref="chartMoney" style="height:280px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="soft-card">
          <div class="section-title"><el-icon><TrendCharts /></el-icon>班组明细（用于菜单/补贴/外包考核）</div>
          <el-table :data="data.teams || []" size="small" stripe height="280">
            <el-table-column prop="teamName" label="班组" min-width="110" />
            <el-table-column prop="generatedCount" label="生成" width="64" align="center" />
            <el-table-column prop="pickupCount" label="取餐" width="64" align="center" />
            <el-table-column prop="wasteCount" label="浪费" width="64" align="center" />
            <el-table-column label="取餐率" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="rateType(row.pickupRate)" size="small">{{ row.pickupRate }}%</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="浪费率" width="90" align="center">
              <template #default="{ row }">
                <span :class="row.wasteRate >= 20 ? 'money-up' : ''">{{ row.wasteRate }}%</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import api from '../api';

const month = ref('');
const data = reactive({ overview: {}, teams: [], complaintTypes: [] });
const chartTeam = ref(), chartComplaint = ref(), chartMoney = ref();
let instTeam, instComp, instMoney;

const kpis = ref([]), kpis2 = ref([]);
const rateType = (r) => (r >= 80 ? 'success' : r >= 60 ? 'warning' : 'danger');

async function load() {
  const d = await api.get('/stats/dashboard', { params: month.value ? { month: month.value } : {} });
  Object.assign(data, d);
  const o = d.overview;
  kpis.value = [
    { label: `订餐生成（${o.sessionCount || 0} 个餐次）`, value: o.orderCount, unit: '份', color: '#1f6f54' },
    { label: '实际取餐', value: o.pickupCount, unit: '份', color: '#2f7ed8' },
    { label: '浪费/报损', value: o.wasteCount, unit: '份', color: '#c45656' },
    { label: '取餐率', value: o.pickupRate, unit: '%', color: o.pickupRate >= 80 ? '#1f6f54' : '#e6a23c' },
  ];
  kpis2.value = [
    { label: '浪费率', value: o.wasteRate, unit: '%', color: o.wasteRate >= 20 ? '#c45656' : '#909399' },
    { label: '个人餐补合计', value: o.workerSubsidyTotal, unit: '元', color: '#1f6f54' },
    { label: '企业补贴合计', value: o.companySubsidyTotal, unit: '元', color: '#2f7ed8' },
    { label: '工人自付合计', value: o.selfPayTotal, unit: '元', color: '#e6a23c' },
  ];
  await nextTick();
  renderCharts();
}

function renderCharts() {
  const teams = data.teams || [];
  instTeam = instTeam || echarts.init(chartTeam.value);
  instTeam.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['取餐率', '浪费率'], top: 0 },
    grid: { left: 40, right: 20, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: teams.map((t) => t.teamName) },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      { name: '取餐率', type: 'bar', data: teams.map((t) => t.pickupRate),
        itemStyle: { color: '#1f6f54', borderRadius: [4, 4, 0, 0] }, label: { show: true, formatter: '{c}%' } },
      { name: '浪费率', type: 'bar', data: teams.map((t) => t.wasteRate),
        itemStyle: { color: '#e08a8a', borderRadius: [4, 4, 0, 0] }, label: { show: true, formatter: '{c}%' } },
    ],
  });

  instComp = instComp || echarts.init(chartComplaint.value);
  const comp = data.complaintTypes || [];
  instComp.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie', radius: ['38%', '66%'], center: ['50%', '44%'],
      data: comp.map((c) => ({ name: c.label, value: c.count })),
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{c} 起' },
      color: ['#e08a8a', '#e6a23c', '#1f6f54', '#2f7ed8', '#8e7cc3', '#f0a35e', '#6aa84f', '#76a5af', '#c27ba0', '#999'],
    }],
  });

  instMoney = instMoney || echarts.init(chartMoney.value);
  const o = data.overview;
  instMoney.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 24, bottom: 30 },
    xAxis: { type: 'category', data: ['个人餐补', '企业补贴', '工人自付'] },
    yAxis: { type: 'value', name: '元' },
    series: [{
      type: 'bar', barWidth: 46,
      data: [
        { value: o.workerSubsidyTotal, itemStyle: { color: '#1f6f54' } },
        { value: o.companySubsidyTotal, itemStyle: { color: '#2f7ed8' } },
        { value: o.selfPayTotal, itemStyle: { color: '#e6a23c' } },
      ],
      label: { show: true, position: 'top', formatter: '¥{c}' }, itemStyle: { borderRadius: [6, 6, 0, 0] },
    }],
  });
}

onMounted(load);
window.addEventListener('resize', () => { instTeam?.resize(); instComp?.resize(); instMoney?.resize(); });
</script>

<style scoped>
.unit { font-size: 13px; font-weight: 400; margin-left: 3px; color: #90a09c; }
</style>
