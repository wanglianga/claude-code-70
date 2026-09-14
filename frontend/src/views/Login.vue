<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="brand">
        <el-icon :size="34" color="#1f6f54"><Food /></el-icon>
        <div>
          <h1>建筑工地食堂订餐留样与农民工补贴平台</h1>
          <p>订餐 · 实名考勤 · 备餐留样 · 刷脸取餐 · 多方协同 · 补贴结算</p>
        </div>
      </div>
      <el-form :model="form" @submit.prevent="submit" class="login-form">
        <el-form-item>
          <el-input v-model="form.username" size="large" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" size="large" type="password" placeholder="密码（演示统一 123456）"
            :prefix-icon="Lock" show-password @keyup.enter="submit" />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="submit">登 录</el-button>
      </el-form>

      <el-divider>演示账号（逐角色，密码均为 123456）</el-divider>
      <div class="accounts">
        <el-tag v-for="a in accounts" :key="a.u" class="acc" :type="a.type" effect="plain"
          @click="quick(a.u)">
          {{ a.label }}：{{ a.u }}
        </el-tag>
      </div>
      <p class="tip">点击账号可自动填充；建议依次体验：班组长订餐 → 平台生成 → 食堂备餐留样 → 工人取餐 → 异常协同 → 月底结算。</p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Food } from '@element-plus/icons-vue';
import api from '../api';
import { useAuthStore } from '../store';

const router = useRouter();
const auth = useAuthStore();
const form = reactive({ username: 'banzu1', password: '123456' });
const loading = ref(false);

const accounts = [
  { u: 'admin', label: '平台管理员', type: 'danger' },
  { u: 'banzu1', label: '班组长', type: 'primary' },
  { u: 'shitang', label: '食堂(厨师长)', type: 'warning' },
  { u: 'xiangmu', label: '项目部', type: 'success' },
  { u: 'caiwu', label: '财务', type: 'info' },
  { u: 'anquan', label: '安全员', type: '' },
  { u: 'gongren', label: '工人', type: 'info' },
];
const quick = (u) => { form.username = u; form.password = '123456'; };

async function submit() {
  if (!form.username || !form.password) return ElMessage.warning('请输入账号密码');
  loading.value = true;
  try {
    const res = await api.post('/auth/login', form);
    auth.setAuth(res.token, res.user);
    ElMessage.success(`欢迎，${res.user.name}`);
    router.push('/dashboard');
  } catch { /* interceptor already toasted */ } finally { loading.value = false; }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #16513e 0%, #1f6f54 55%, #2e8b6a 100%);
  padding: 24px;
}
.login-card {
  width: 520px; max-width: 100%;
  background: #fff; border-radius: 18px; padding: 34px 36px 26px;
  box-shadow: 0 24px 60px rgba(0,0,0,.25);
}
.brand { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 20px; }
.brand h1 { font-size: 19px; margin: 4px 0 6px; color: #16513e; line-height: 1.35; }
.brand p { margin: 0; font-size: 12.5px; color: #7a8a86; }
.login-form { margin-top: 6px; }
.accounts { display: flex; flex-wrap: wrap; gap: 8px; }
.acc { cursor: pointer; }
.tip { font-size: 12px; color: #93a19d; margin-top: 14px; line-height: 1.6; }
</style>
