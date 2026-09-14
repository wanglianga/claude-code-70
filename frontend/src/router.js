import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/login', component: () => import('./views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('./views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: '管理看板', component: () => import('./views/Dashboard.vue') },
      { path: 'orders', name: '订餐申报', component: () => import('./views/Orders.vue') },
      { path: 'canteen', name: '备餐留样配送', component: () => import('./views/Canteen.vue') },
      { path: 'extra', name: '夜间加餐', component: () => import('./views/ExtraMeal.vue') },
      { path: 'pickup', name: '取餐终端', component: () => import('./views/Pickup.vue') },
      { path: 'incidents', name: '异常协同', component: () => import('./views/Incidents.vue') },
      { path: 'archive', name: '结算与后勤档案', component: () => import('./views/Archive.vue') },
      { path: 'workers', name: '工人实名考勤', component: () => import('./views/Workers.vue') },
      { path: 'basic', name: '基础档案', component: () => import('./views/Basic.vue') },
    ],
  },
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  if (!to.meta.public && !token) return '/login';
  if (to.path === '/login' && token) return '/dashboard';
  return true;
});

export default router;
