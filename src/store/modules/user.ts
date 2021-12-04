import type { UserInfo } from '/#/store';
import type { ErrorMessageMode } from '/#/axios';
import { defineStore } from 'pinia';
import { store } from '/@/store';
import { RoleEnum } from '/@/enums/roleEnum';
import { PageEnum } from '/@/enums/pageEnum';
import { ROLES_KEY, TOKEN_KEY, USER_INFO_KEY } from '/@/enums/cacheEnum';
import { getAuthCache, setAuthCache } from '/@/utils/auth';
import { GetUserInfoModel, LoginParams } from '/@/api/sys/model/userModel';
import { doLogout, getUserInfo, loginApi } from '/@/api/sys/user';
import { useI18n } from '/@/hooks/web/useI18n';
import { useMessage } from '/@/hooks/web/useMessage';
import { router } from '/@/router';
import { usePermissionStore } from '/@/store/modules/permission';
import { RouteRecordRaw } from 'vue-router';
import { PAGE_NOT_FOUND_ROUTE } from '/@/router/routes/basic';
import { isArray } from '/@/utils/is';
import { h } from 'vue';

interface UserState {
  userInfo: Nullable<UserInfo>;
  token?: string;
  roleList: RoleEnum[];
  sessionTimeout?: boolean;
  lastUpdateTime: number;
}

export const useUserStore = defineStore({
  id: 'app-user',
  state: (): UserState => ({
    // user info
    userInfo: null,
    // token
    token: undefined,
    // roleList
    roleList: [],
    // Whether the login expired 判断当前的登录是否过期
    sessionTimeout: false,
    // Last fetch time
    lastUpdateTime: 0,
  }),
  getters: {
    // 获取用户信息 （如果当前store中没有的话 则从缓存中去取）
    getUserInfo(): UserInfo {
      return this.userInfo || getAuthCache<UserInfo>(USER_INFO_KEY) || {};
    },
    // 获取token信息 （如果当前store中没有的话 则从缓存中去取）
    getToken(): string {
      return this.token || getAuthCache<string>(TOKEN_KEY);
    },
    // 获取角色信息 （如果当前store中没有的话 则从缓存中去取）
    getRoleList(): RoleEnum[] {
      return this.roleList.length > 0 ? this.roleList : getAuthCache<RoleEnum[]>(ROLES_KEY);
    },
    // 获取是否登录过期
    getSessionTimeout(): boolean {
      return !!this.sessionTimeout;
    },
    // 用户信息最新的更新时间
    getLastUpdateTime(): number {
      return this.lastUpdateTime;
    },
  },
  actions: {
    setToken(info: string | undefined) {
      this.token = info ? info : ''; // for null or undefined value
      // 设置token信息到缓存中
      setAuthCache(TOKEN_KEY, info);
    },
    setRoleList(roleList: RoleEnum[]) {
      this.roleList = roleList;
      // 设置角色信息到缓存中
      setAuthCache(ROLES_KEY, roleList);
    },
    // 设置对应的store中的用户信息
    setUserInfo(info: UserInfo | null) {
      this.userInfo = info;
      this.lastUpdateTime = new Date().getTime();
      // 设置用户信息到缓存中
      setAuthCache(USER_INFO_KEY, info);
    },
    // 设置登录过期的标志位
    setSessionTimeout(flag: boolean) {
      this.sessionTimeout = flag;
    },
    // 重置当前的user state 用于当退出登录或者登录过期重置
    resetState() {
      this.userInfo = null;
      this.token = '';
      this.roleList = [];
      this.sessionTimeout = false;
    },
    /**
     * @description: login 登录方法
     */
    async login(
      params: LoginParams & {
        goHome?: boolean;
        mode?: ErrorMessageMode;
      },
    ): Promise<GetUserInfoModel | null> {
      try {
        // 从传入的参数中获取对应的登录参数及登录的配置
        const { goHome = true, mode, ...loginParams } = params;
        // 调用登录接口  mode 为none 不要默认的错误提示 因为后续要自定义登录后的提示
        const data = await loginApi(loginParams, mode);
        const { token } = data;

        // save token 保存token
        this.setToken(token);
        // 返回登录后的处理结果
        return this.afterLoginAction(goHome);
      } catch (error) {
        // 如果执行过程中报错 则会被外层捕获到 进行弹窗提示
        return Promise.reject(error);
      }
    },

    // 登录后的处理逻辑
    async afterLoginAction(goHome?: boolean): Promise<GetUserInfoModel | null> {
      // 如果没有获取对应的token 则返回null
      if (!this.getToken) return null;
      // get user info 登录后需要获取用户信息
      const userInfo = await this.getUserInfoAction();

      // 判断当前的登录是否过期
      const sessionTimeout = this.sessionTimeout;
      if (sessionTimeout) {
        this.setSessionTimeout(false);
      } else {
        // 如果没有过期的话 则需要请求 对应的后台管理系统对应的路由菜单权限
        const permissionStore = usePermissionStore();
        if (!permissionStore.isDynamicAddedRoute) {
          // buildRoutesAction 生成对应的权限路由列表
          const routes = await permissionStore.buildRoutesAction();
          // 将对应的路由动态添加到当前的路由实例中
          routes.forEach((route) => {
            router.addRoute(route as unknown as RouteRecordRaw);
          });
          // 在路由实例的最后添加页面找不到路由配置
          router.addRoute(PAGE_NOT_FOUND_ROUTE as unknown as RouteRecordRaw);
          // 异步动态路由生成完毕 将对应的权限路由设置状态为true
          permissionStore.setDynamicAddedRoute(true);
        }
        // 如果登录成功后 设置了跳转首页的话 则路由跳转到后端返回的主页路由 如果没有的话则跳到根路由
        goHome && (await router.replace(userInfo?.homePath || PageEnum.BASE_HOME));
      }
      // 返回用户信息
      return userInfo;
    },

    // 获取用户信息
    async getUserInfoAction(): Promise<UserInfo | null> {
      // 必须要有token才会去调用获取登录信息的接口
      if (!this.getToken) return null;
      const userInfo = await getUserInfo();
      const { roles = [] } = userInfo;
      // 如果登录信息中的返回的角色是一个角色列表的话 则取出对应的值 存入角色对应得store中
      if (isArray(roles)) {
        const roleList = roles.map((item) => item.value) as RoleEnum[];
        this.setRoleList(roleList);
      } else {
        // 如果返回的角色不是数组的话 则赋值一个空数组
        userInfo.roles = [];
        // 对应的角色列表也设置为空
        this.setRoleList([]);
      }
      this.setUserInfo(userInfo);
      return userInfo;
    },
    /**
     * @description: logout 退出登录方法
     */
    async logout(goLogin = false) {
      if (this.getToken) {
        try {
          // 调用退出登录接口
          await doLogout();
        } catch {
          console.log('注销Token失败');
        }
      }
      // 清空对应的token、userInfo字段
      this.setToken(undefined);
      // 这不是登录过期
      this.setSessionTimeout(false);
      this.setUserInfo(null);
      // 跳转到登录页面 goLogin如果传入true
      goLogin && router.push(PageEnum.BASE_LOGIN);
    },

    /**
     * @description: Confirm before logging out 退出登录提示确认框
     */
    confirmLoginOut() {
      const { createConfirm } = useMessage();
      const { t } = useI18n();
      createConfirm({
        iconType: 'warning',
        title: () => h('span', t('sys.app.logoutTip')),
        content: () => h('span', t('sys.app.logoutMessage')),
        onOk: async () => {
          await this.logout(true);
        },
      });
    },
  },
});

// Need to be used outside the setup
export function useUserStoreWithOut() {
  return useUserStore(store);
}
