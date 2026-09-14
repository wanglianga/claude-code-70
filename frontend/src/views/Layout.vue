<template>
  <el-container class="layout">
    <el-aside width="230px" class="aside">
      <div class="logo">
        <el-icon :size="22"><Food /></el-icon>
        <span>工地智慧食堂</span>
      </div>
      <el-menu :default-active="route.path" router :collapse="false" class="menu"
        background-color="#163f32" text-color="#cfe0da" active-text-color="#ffd98a">
        <el-menu-item index="/dashboard"><el-icon><DataLine /></el-icon><span>管理看板</span></el-menu-item>
        <el-menu-item index="/orders"><el-icon><EditPen /></el-icon><span>订餐申报/生成</span></el-menu-item>
        <el-menu-item index="/canteen"><el-icon><Bowl /></el-icon><span>备餐·留样·配送</span></el-menu-item>
        <el-menu-item index="/pickup"><el-icon><Avatar /></el-icon><span>取餐终端</span></el-menu-item>
        <el-menu-item index="/incidents"><el-icon><Warning /></el-icon><span>异常协同</span></el-menu-item>
        <el-menu-item index="/archive"><el-icon><Document /></el-icon><span>结算/后勤档案</span></el-menu-item>
        <el-menu-item index="/workers"><el-icon><Postcard /></el-icon><span>工人实名考勤</span></el-menu-item>
        <el-menu-item index="/basic"><el-icon><OfficeBuilding /></el-icon><span>基础档案</span></el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="title">订餐 · 留样 · 补贴一体化协同平台</div>
        <div class="user">
          <el-tag :type="roleType" effect="dark" round>{{ ROLE_LABELS[auth.role] || auth.role }}</el-tag>
          <el-dropdown @command="onCmd">
            <span class="uname">
              <el-icon><UserFilled /></el-icon> {{ auth.user?.name }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore, ROLE_LABELS } from '../store';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const roleType = {
  ADMIN: 'danger', FOREMAN: 'primary', CANTEEN: 'warning', PROJECT: 'success',
  FINANCE: 'info', SAFETY: '', WORKER: 'info',
}[auth.role] || '';

function onCmd(c) {
  if (c === 'logout') { auth.logout(); router.push('/login'); }
}
</script>

<style scoped>
.layout { height: 100vh; }
.aside { background: #163f32; display: flex; flex-direction: column; }
.logo {
  height: 60px; display: flex; align-items: center; gap: 10px;
  color: #fff; font-weight: 700; font-size: 17px; padding: 0 18px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.menu { border-right: none; flex: 1; }
:deep(.el-menu-item.is-active) { background-color: #1f6f54 !important; }
.header {
  background: #fff; display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 1px 6px rgba(0,0,0,.06);
}
.header .title { font-weight: 600; color: #2a3b37; }
.user { display: flex; align-items: center; gap: 12px; }
.uname { display: flex; align-items: center; gap: 5px; cursor: pointer; color: #33453f; outline: none; }
.main { background: var(--bg); padding: 18px 22px; overflow-y: auto; }
</style>
