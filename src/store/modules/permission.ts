import type { AppRouteRecordRaw, Menu } from '/@/router/types';

import { defineStore } from 'pinia';
import { store } from '/@/store';
import { useI18n } from '/@/hooks/web/useI18n';
import { useUserStore } from './user';
import { useAppStoreWithOut } from './app';
import { toRaw } from 'vue';
import { transformObjToRoute, flatMultiLevelRoutes } from '/@/router/helper/routeHelper';
import { transformRouteToMenu } from '/@/router/helper/menuHelper';

import projectSetting from '/@/settings/projectSetting';

import { PermissionModeEnum } from '/@/enums/appEnum';

import { asyncRoutes } from '/@/router/routes';
import { ERROR_LOG_ROUTE, PAGE_NOT_FOUND_ROUTE } from '/@/router/routes/basic';

import { filter } from '/@/utils/helper/treeHelper';

import { getMenuList } from '/@/api/sys/menu';
import { getPermCode } from '/@/api/sys/user';

import { useMessage } from '/@/hooks/web/useMessage';
import { PageEnum } from '/@/enums/pageEnum';

interface PermissionState {
  // Permission code list
  permCodeList: string[] | number[];
  // Whether the route has been dynamically added
  isDynamicAddedRoute: boolean;
  // To trigger a menu update
  lastBuildMenuTime: number;
  // Backstage menu list
  backMenuList: Menu[];
  frontMenuList: Menu[];
}
export const usePermissionStore = defineStore({
  id: 'app-permission',
  state: (): PermissionState => ({
    permCodeList: [],
    // Whether the route has been dynamically added
    isDynamicAddedRoute: false,
    // To trigger a menu update
    lastBuildMenuTime: 0,
    // Backstage menu list
    backMenuList: [],
    // menu List
    frontMenuList: [],
  }),
  getters: {
    getPermCodeList(): string[] | number[] {
      return this.permCodeList;
    },
    getBackMenuList(): Menu[] {
      return this.backMenuList;
    },
    getFrontMenuList(): Menu[] {
      return this.frontMenuList;
    },
    getLastBuildMenuTime(): number {
      return this.lastBuildMenuTime;
    },
    getIsDynamicAddedRoute(): boolean {
      return this.isDynamicAddedRoute;
    },
  },
  actions: {
    setPermCodeList(codeList: string[]) {
      this.permCodeList = codeList;
    },

    setBackMenuList(list: Menu[]) {
      this.backMenuList = list;
      list?.length > 0 && this.setLastBuildMenuTime();
    },

    setFrontMenuList(list: Menu[]) {
      this.frontMenuList = list;
    },

    setLastBuildMenuTime() {
      this.lastBuildMenuTime = new Date().getTime();
    },

    setDynamicAddedRoute(added: boolean) {
      this.isDynamicAddedRoute = added;
    },
    resetState(): void {
      this.isDynamicAddedRoute = false;
      this.permCodeList = [];
      this.backMenuList = [];
      this.lastBuildMenuTime = 0;
    },
    async changePermissionCode() {
      // 重新调用接口获取权限码
      const codeList = await getPermCode();
      this.setPermCodeList(codeList);
    },

    // 生成动态路由
    async buildRoutesAction(): Promise<AppRouteRecordRaw[]> {
      const { t } = useI18n();
      const userStore = useUserStore();
      const appStore = useAppStoreWithOut();

      let routes: AppRouteRecordRaw[] = [];
      // 将userStore中的角色列表展开
      const roleList = toRaw(userStore.getRoleList) || [];
      // 获取当前项目配置中的路由模式
      const { permissionMode = projectSetting.permissionMode } = appStore.getProjectConfig;

      // 主要用来用角色过滤路由 如果路由的meta中设置了对应的角色的话 则返回true存入roleList
      const routeFilter = (route: AppRouteRecordRaw) => {
        const { meta } = route;
        // 从meta中获取roles
        const { roles } = meta || {};
        if (!roles) return true;
        return roleList.some((role) => roles.includes(role));
      };

      // 如果路由中的meta设置了ignoreRoute为true的话 则过滤该路由
      const routeRemoveIgnoreFilter = (route: AppRouteRecordRaw) => {
        const { meta } = route;
        const { ignoreRoute } = meta || {};
        return !ignoreRoute;
      };

      /**
       * @description 根据设置的首页path，修正routes中的affix标记（固定首页）
       * */
      const patchHomeAffix = (routes: AppRouteRecordRaw[]) => {
        if (!routes || routes.length === 0) return;
        // 获取主页路由path
        let homePath: string = userStore.getUserInfo.homePath || PageEnum.BASE_HOME;
        function patcher(routes: AppRouteRecordRaw[], parentPath = '') {
          if (parentPath) parentPath = parentPath + '/';
          routes.forEach((route: AppRouteRecordRaw) => {
            const { path, children, redirect } = route;
            // 如果路由的path开头是否有 以/开头 是的话则返回path 否则拼接上父路由
            const currentPath = path.startsWith('/') ? path : parentPath + path;
            // 如果当前路由与主页路由相同 并且有重定向路由的话 则将重定向路由赋值给homepath
            if (currentPath === homePath) {
              if (redirect) {
                homePath = route.redirect! as string;
              } else {
                // 如果路由列表中匹配不到homepath的话 则将当前路由设置affix标记 固定为首页
                route.meta = Object.assign({}, route.meta, { affix: true });
                // 为了跳出循环 抛出一个Error
                throw new Error('end');
              }
            }
            // 如果有childer的话 则进行递归调用
            children && children.length > 0 && patcher(children, currentPath);
          });
        }
        try {
          patcher(routes);
        } catch (e) {
          // 已处理完毕跳出循环
        }
        return;
      };

      // 根据对应的路由模式 执行对应的路由菜单转换逻辑
      switch (permissionMode) {
        // 角色路由 通过用户角色来过滤菜单(前端方式控制)，菜单和路由分开配置
        case PermissionModeEnum.ROLE:
          // 通过角色将路由列表过滤出来 filter传入一个过滤函数内部有孩子的话会递归调用
          // 第一次过滤 只能过滤孩子
          routes = filter(asyncRoutes, routeFilter);
          // 第二次过滤 父亲路由
          routes = routes.filter(routeFilter);
          // 将多级路由拍平为二级路由 所有的多级路由最终都会转成二级路由，所以不能内嵌子路由
          routes = flatMultiLevelRoutes(routes);
          break;

        // 角色路由 通过用户角色来过滤菜单(前端方式控制)，菜单由路由配置自动生成
        case PermissionModeEnum.ROUTE_MAPPING:
          // 第一次过滤 只能过滤孩子
          routes = filter(asyncRoutes, routeFilter);
          // 第二次过滤 父亲路由
          routes = routes.filter(routeFilter);
          // 将当前的路由列表映射到对应的菜单menu中 生成菜单列表
          const menuList = transformRouteToMenu(routes, true);
          // 第一次过滤 只能过滤孩子
          routes = filter(routes, routeRemoveIgnoreFilter);
          // 第二次过滤 父亲路由
          routes = routes.filter(routeRemoveIgnoreFilter);
          menuList.sort((a, b) => {
            return (a.meta?.orderNo || 0) - (b.meta?.orderNo || 0);
          });
          // 将前端路由菜单存入store
          this.setFrontMenuList(menuList);
          // 将多级路由拍平为二级路由 所有的多级路由最终都会转成二级路由，所以不能内嵌子路由
          routes = flatMultiLevelRoutes(routes);
          break;

        // 后台动态路由 通过后台来动态生成路由表(后台方式控制)
        case PermissionModeEnum.BACK:
          const { createMessage } = useMessage();

          createMessage.loading({
            content: t('sys.app.menuLoading'),
            duration: 1,
          });

          // 模拟从后台获取权限码，这个函数可能只需要执行一次，并且实际的项目本身可以在正确的时间被放置
          let routeList: AppRouteRecordRaw[] = [];
          try {
            // 转化改变当前的权限 需要重新调用获取权限码接口
            this.changePermissionCode();
            // 调用后台接口获取当前菜单列表
            routeList = (await getMenuList()) as AppRouteRecordRaw[];
          } catch (error) {
            console.error(error);
          }

          // 动态引入组件
          routeList = transformObjToRoute(routeList);

          // 后台路由转化成菜单格式列表
          const backMenuList = transformRouteToMenu(routeList);
          // 将菜单列表存入store
          this.setBackMenuList(backMenuList);

          // 移除路由meta中ignoreRoute的项
          // 第一次过滤 只能过滤孩子
          routeList = filter(routeList, routeRemoveIgnoreFilter);
          // 第二次过滤 父亲路由
          routeList = routeList.filter(routeRemoveIgnoreFilter);
          // 将多级路由拍平为二级路由 所有的多级路由最终都会转成二级路由，所以不能内嵌子路由
          routeList = flatMultiLevelRoutes(routeList);
          // 最后需要将路由找不到页面添加进入路由列表
          routes = [PAGE_NOT_FOUND_ROUTE, ...routeList];
          break;
      }
      // 最后一项添加日志路由
      routes.push(ERROR_LOG_ROUTE);
      // 根据设置的首页path，修正routes中的affix标记（固定首页）
      patchHomeAffix(routes);
      return routes;
    },
  },
});

// Need to be used outside the setup 提供给外部使用
export function usePermissionStoreWithOut() {
  return usePermissionStore(store);
}
