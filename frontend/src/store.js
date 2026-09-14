import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }),
  getters: {
    role: (s) => s.user?.role || '',
    isLogin: (s) => !!s.token,
  },
  actions: {
    setAuth(token, user) {
      this.token = token; this.user = user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    logout() {
      this.token = ''; this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const ROLE_LABELS = {
  ADMIN: '平台管理员', FOREMAN: '班组长', CANTEEN: '食堂', PROJECT: '项目部',
  FINANCE: '财务', SAFETY: '安全员', WORKER: '工人',
};
