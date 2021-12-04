import type { RouteRecordRaw } from 'vue-router';
import type { App } from 'vue';

import { createRouter, createWebHashHistory } from 'vue-router';
import { basicRoutes } from './routes';

// 白名单应该包含基本静态路由 （这里的路由会不做校验）
const WHITE_NAME_LIST: string[] = [];

// 获取路由名称 往WHITE_NAME_LIST中添加
const getRouteNames = (array: any[]) =>
  array.forEach((item) => {
    WHITE_NAME_LIST.push(item.name);
    getRouteNames(item.children || []);
  });

getRouteNames(basicRoutes);

// app router 创建项目路由实例
export const router = createRouter({
  // 根据env中的public path 生成对应的基本路由前缀  并与hash 路由创建
  history: createWebHashHistory(import.meta.env.VITE_PUBLIC_PATH),
  routes: basicRoutes as unknown as RouteRecordRaw[],
  strict: true,
  scrollBehavior: () => ({ left: 0, top: 0 }),
});

// reset router 重置当前路由
export function resetRouter() {
  // 新版本的vue-router 不能再使用以前的removeRoutes 而需要单个remove
  router.getRoutes().forEach((route) => {
    const { name } = route;
    // 删除路由实例中对应的路由时 需要过滤掉项目的基础静态路由
    if (name && !WHITE_NAME_LIST.includes(name as string)) {
      // 循环遍历当前路由实例下的所有路由 判断是否存在  条件满足则删除重置
      router.hasRoute(name) && router.removeRoute(name);
    }
  });
}

// config router 暴露出方法 传入vue app实例挂载路由
export function setupRouter(app: App<Element>) {
  app.use(router);
}
