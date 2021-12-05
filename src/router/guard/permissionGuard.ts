import type { Router, RouteRecordRaw } from 'vue-router';

import { usePermissionStoreWithOut } from '/@/store/modules/permission';

import { PageEnum } from '/@/enums/pageEnum';
import { useUserStoreWithOut } from '/@/store/modules/user';

import { PAGE_NOT_FOUND_ROUTE } from '/@/router/routes/basic';

import { RootRoute } from '/@/router/routes';

const LOGIN_PATH = PageEnum.BASE_LOGIN;

const ROOT_PATH = RootRoute.path;

// 路由权限白名单（登录页面）
const whitePathList: PageEnum[] = [LOGIN_PATH];

export function createPermissionGuard(router: Router) {
  const userStore = useUserStoreWithOut();
  const permissionStore = usePermissionStoreWithOut();
  router.beforeEach(async (to, from, next) => {
    // 如果来源页面是根路由并且目标路径是/dashboard和后台返回的homePath存在则优先跳转后台返回的homePath
    if (
      from.path === ROOT_PATH &&
      to.path === PageEnum.BASE_HOME &&
      userStore.getUserInfo.homePath &&
      userStore.getUserInfo.homePath !== PageEnum.BASE_HOME
    ) {
      next(userStore.getUserInfo.homePath);
      return;
    }

    const token = userStore.getToken;

    // 白名单的页面可以直接进入
    if (whitePathList.includes(to.path as PageEnum)) {
      // 如果目标页面是登录页面  并且 登录的token存在则判断是否登录过期
      if (to.path === LOGIN_PATH && token) {
        const isSessionTimeout = userStore.getSessionTimeout;
        try {
          // 调用登录后的处理逻辑 这里会再去获取用户信息 如果登录信息过期的话 则isSessionTimeout会为true
          await userStore.afterLoginAction();
          // 如果没有过期的话 也就是isSessionTimeout 为false 则跳转到query中的redirect路径否则就跳到首页
          if (!isSessionTimeout) {
            next((to.query?.redirect as string) || '/');
            return;
          }
        } catch {}
      }
      next();
      return;
    }

    // 如果token不存在的话
    if (!token) {
      // 当前路由是否可以直接访问，需要设置路由meta中的ignoreAuth为true
      if (to.meta.ignoreAuth) {
        next();
        return;
      }

      // 否则跳转到登录页面
      const redirectData: { path: string; replace: boolean; query?: Recordable<string> } = {
        path: LOGIN_PATH,
        replace: true,
      };
      // 如果要跳转的目标路径存在，让query中设置redirect 以便重新登录后回到原始页面
      if (to.path) {
        redirectData.query = {
          ...redirectData.query,
          redirect: to.path,
        };
      }
      next(redirectData);
      return;
    }

    // 如果来源是登录页面并且目标页面无法匹配则跳转到项目首页
    if (
      from.path === LOGIN_PATH &&
      to.name === PAGE_NOT_FOUND_ROUTE.name &&
      to.fullPath !== (userStore.getUserInfo.homePath || PageEnum.BASE_HOME)
    ) {
      next(userStore.getUserInfo.homePath || PageEnum.BASE_HOME);
      return;
    }

    // 当上次获取用户信息更新时间为空时 即第一次登录(因为token存在 但是又没有获取用户信息的情况)
    if (userStore.getLastUpdateTime === 0) {
      try {
        // 需要重新调用获取用户信息
        await userStore.getUserInfoAction();
      } catch (err) {
        next();
        return;
      }
    }

    // 判断路由权限列表是否添加完成
    if (permissionStore.getIsDynamicAddedRoute) {
      next();
      return;
    }

    // 如果没有添加的话 则重新调用路由权限动态生成
    const routes = await permissionStore.buildRoutesAction();

    routes.forEach((route) => {
      // 将对应的路由动态添加到当前的路由实例中
      router.addRoute(route as unknown as RouteRecordRaw);
    });
    // 在路由实例的最后添加页面找不到路由配置
    router.addRoute(PAGE_NOT_FOUND_ROUTE as unknown as RouteRecordRaw);
    // 异步动态路由生成完毕 将对应的权限路由设置状态为true
    permissionStore.setDynamicAddedRoute(true);

    // 如果目标的页面name为PageNotFound 则需要重定向到fullPath
    if (to.name === PAGE_NOT_FOUND_ROUTE.name) {
      // 动态添加路由后，此处应当重定向到fullPath，否则会加载404页面内容
      next({ path: to.fullPath, replace: true, query: to.query });
    } else {
      // 从query中取出redirect 跳转到对应页面
      const redirectPath = (from.query.redirect || to.path) as string;
      const redirect = decodeURIComponent(redirectPath);
      const nextData = to.path === redirect ? { ...to, replace: true } : { path: redirect };
      next(nextData);
    }
  });
}
