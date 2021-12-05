import type { Router } from 'vue-router';
import { configureDynamicParamsMenu } from '../helper/menuHelper';
import { Menu } from '../types';
import { PermissionModeEnum } from '/@/enums/appEnum';
import { useAppStoreWithOut } from '/@/store/modules/app';

import { usePermissionStoreWithOut } from '/@/store/modules/permission';

export function createParamMenuGuard(router: Router) {
  const permissionStore = usePermissionStoreWithOut();
  router.beforeEach(async (to, _, next) => {
    // filter no name route
    if (!to.name) {
      next();
      return;
    }

    // 判断菜单是否已经添加完成
    if (!permissionStore.getIsDynamicAddedRoute) {
      next();
      return;
    }

    let menus: Menu[] = [];
    // 判断是否是后端路由模式
    if (isBackMode()) {
      // 如果是则直接获取后台菜单列表
      menus = permissionStore.getBackMenuList;
    } else if (isRouteMappingMode()) {
      // 否则如果是角色路由映射模式 则直接获取前端菜单列表
      menus = permissionStore.getFrontMenuList;
    }
    menus.forEach((item) => configureDynamicParamsMenu(item, to.params));

    next();
  });
}

const getPermissionMode = () => {
  const appStore = useAppStoreWithOut();
  return appStore.getProjectConfig.permissionMode;
};

const isBackMode = () => {
  return getPermissionMode() === PermissionModeEnum.BACK;
};

const isRouteMappingMode = () => {
  return getPermissionMode() === PermissionModeEnum.ROUTE_MAPPING;
};
