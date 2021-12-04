import type { AppRouteRecordRaw, AppRouteModule } from '/@/router/types';

import { PAGE_NOT_FOUND_ROUTE, REDIRECT_ROUTE } from '/@/router/routes/basic';

import { mainOutRoutes } from './mainOut';
import { PageEnum } from '/@/enums/pageEnum';
import { t } from '/@/hooks/web/useI18n';

// 加载当前routes下的modules目录下的所有.ts结尾的文件
const modules = import.meta.globEager('./modules/**/*.ts');

// 存放各模块路由列表（前端路由）
const routeModuleList: AppRouteModule[] = [];

// 遍历出模块中的内容 获取对应模块的路由列表添加到routeModuleList
Object.keys(modules).forEach((key) => {
  const mod = modules[key].default || {};
  const modList = Array.isArray(mod) ? [...mod] : [mod];
  routeModuleList.push(...modList);
});

// 异步路由列表 路由中需要有路由找不到的*通配路由
export const asyncRoutes = [PAGE_NOT_FOUND_ROUTE, ...routeModuleList];

// 获取根路由
export const RootRoute: AppRouteRecordRaw = {
  path: '/',
  name: 'Root',
  redirect: PageEnum.BASE_HOME,
  meta: {
    title: 'Root',
  },
};

// 登录路由
export const LoginRoute: AppRouteRecordRaw = {
  path: '/login',
  name: 'Login',
  component: () => import('/@/views/sys/login/Login.vue'),
  meta: {
    title: t('routes.basic.login'),
  },
};

// 基本静态路由包含 登录、根路由dashboard、跳转路由、页面未找到路由
export const basicRoutes = [
  LoginRoute,
  RootRoute,
  ...mainOutRoutes,
  REDIRECT_ROUTE,
  PAGE_NOT_FOUND_ROUTE,
];
