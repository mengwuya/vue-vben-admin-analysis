import type { Router } from 'vue-router';
import { useAppStore } from '/@/store/modules/app';
import { useMultipleTabStore } from '/@/store/modules/multipleTab';
import { useUserStore } from '/@/store/modules/user';
import { usePermissionStore } from '/@/store/modules/permission';
import { PageEnum } from '/@/enums/pageEnum';
import { removeTabChangeListener } from '/@/logics/mitt/routeChange';

// 当页面退出登录或者过期时 重新初始化tabStore、userStore、permissionStore、appStore数据
export function createStateGuard(router: Router) {
  router.afterEach((to) => {
    // 当目标跳转页面为登录页面并清除身份验证信息
    if (to.path === PageEnum.BASE_LOGIN) {
      const tabStore = useMultipleTabStore();
      const userStore = useUserStore();
      const appStore = useAppStore();
      const permissionStore = usePermissionStore();
      appStore.resetAllState();
      permissionStore.resetState();
      tabStore.resetState();
      userStore.resetState();
      // 移除页面tab切换的监听
      removeTabChangeListener();
    }
  });
}
