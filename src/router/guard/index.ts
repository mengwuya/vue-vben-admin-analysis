import type { Router, RouteLocationNormalized } from 'vue-router';
import { useAppStoreWithOut } from '/@/store/modules/app';
import { useUserStoreWithOut } from '/@/store/modules/user';
import { useTransitionSetting } from '/@/hooks/setting/useTransitionSetting';
import { AxiosCanceler } from '/@/utils/http/axios/axiosCancel';
import { Modal, notification } from 'ant-design-vue';
import { warn } from '/@/utils/log';
import { unref } from 'vue';
import { setRouteChange } from '/@/logics/mitt/routeChange';
import { createPermissionGuard } from './permissionGuard';
import { createStateGuard } from './stateGuard';
import nProgress from 'nprogress';
import projectSetting from '/@/settings/projectSetting';
import { createParamMenuGuard } from './paramMenuGuard';

// 这里注意 不要改变各个守卫的创建顺序
export function setupRouterGuard(router: Router) {
  // 创建处理页面状态的守卫钩子
  createPageGuard(router);
  // 创建页面loading状态的守卫
  createPageLoadingGuard(router);
  // 创建http请求的守卫
  createHttpGuard(router);
  // 创建滚动守卫
  createScrollGuard(router);
  // 创建消息提示守卫
  createMessageGuard(router);
  // 创建页面加载进度守卫
  createProgressGuard(router);
  // 创建权限守卫
  createPermissionGuard(router);
  // 创建参数转菜单守卫（必须在权限守卫之后创建因为这时候菜单已经创建）
  createParamMenuGuard(router); // must after createPermissionGuard (menu has been built.)
  // 创建store state守卫
  createStateGuard(router);
}

/**
 * 处理页面状态的钩子
 */
function createPageGuard(router: Router) {
  const loadedPageMap = new Map<string, boolean>();

  router.beforeEach(async (to) => {
    // 页面已经加载，重新打开会更快，不需要进行加载和其他处理
    to.meta.loaded = !!loadedPageMap.get(to.path);
    // 通知路由变化
    setRouteChange(to);
    return true;
  });

  router.afterEach((to) => {
    // 对应的路由页面已经加载过的话 会往loadedPageMap添加
    loadedPageMap.set(to.path, true);
  });
}

// 用于处理页面加载状态
function createPageLoadingGuard(router: Router) {
  const userStore = useUserStoreWithOut();
  const appStore = useAppStoreWithOut();
  // 从项目动画配置中获取是否开启页面loading效果
  const { getOpenPageLoading } = useTransitionSetting();
  router.beforeEach(async (to) => {
    // 如果没有用户token 则直接跳过
    if (!userStore.getToken) {
      return true;
    }
    // 如果页面已经加载过 直接跳过
    if (to.meta.loaded) {
      return true;
    }

    // 设置应用页面loading
    if (unref(getOpenPageLoading)) {
      appStore.setPageLoadingAction(true);
      return true;
    }

    return true;
  });
  router.afterEach(async () => {
    if (unref(getOpenPageLoading)) {
      // TODO Looking for a better way
      // The timer simulates the loading time to prevent flashing too fast,
      // 计时器模拟加载时间，以防止闪烁太快
      setTimeout(() => {
        appStore.setPageLoading(false);
      }, 220);
    }
    return true;
  });
}

/**
 * 路由切换时关闭当前页面是否取消当前正在pending的请求接口
 * @param router
 */
function createHttpGuard(router: Router) {
  // 从设置中获取切换接口时是否取消已经发送但没有响应的http请求
  const { removeAllHttpPending } = projectSetting;
  let axiosCanceler: Nullable<AxiosCanceler>;
  if (removeAllHttpPending) {
    axiosCanceler = new AxiosCanceler();
  }
  router.beforeEach(async () => {
    // 切换路由将删除之前的请求
    // 取消已经发送但没有响应的http请求
    axiosCanceler?.removeAllPending();
    return true;
  });
}

// 路由切换时滚动条回到页面顶部
function createScrollGuard(router: Router) {
  const isHash = (href: string) => {
    return /^#/.test(href);
  };

  const body = document.body;

  router.afterEach(async (to) => {
    // 如果是hash路由的话滚动到顶部
    isHash((to as RouteLocationNormalized & { href: string })?.href) && body.scrollTo(0, 0);
    return true;
  });
}

/**
 * 用于在路由切换时关闭消息实例
 * @param router
 */
export function createMessageGuard(router: Router) {
  // 切换接口时是否删除未关闭消息和通知
  const { closeMessageOnSwitch } = projectSetting;

  router.beforeEach(async () => {
    try {
      if (closeMessageOnSwitch) {
        Modal.destroyAll();
        notification.destroy();
      }
    } catch (error) {
      warn('message guard error:' + error);
    }
    return true;
  });
}

// 页面加载进度条
export function createProgressGuard(router: Router) {
  const { getOpenNProgress } = useTransitionSetting();
  router.beforeEach(async (to) => {
    // 如果页面路由已经加载过 则直接跳过
    if (to.meta.loaded) {
      return true;
    }
    // 开启进度条
    unref(getOpenNProgress) && nProgress.start();
    return true;
  });

  router.afterEach(async () => {
    // 关闭进度条
    unref(getOpenNProgress) && nProgress.done();
    return true;
  });
}
