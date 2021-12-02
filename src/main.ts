import '/@/design/index.less';
import 'virtual:windi-base.css';
import 'virtual:windi-components.css';
import 'virtual:windi-utilities.css';
// Register icon sprite
import 'virtual:svg-icons-register';
import App from './App.vue';
import { createApp } from 'vue';
import { initAppConfigStore } from '/@/logics/initAppConfig';
import { setupErrorHandle } from '/@/logics/error-handle';
import { router, setupRouter } from '/@/router';
import { setupRouterGuard } from '/@/router/guard';
import { setupStore } from '/@/store';
import { setupGlobDirectives } from '/@/directives';
import { setupI18n } from '/@/locales/setupI18n';
import { registerGlobComp } from '/@/components/registerGlobComp';

// Importing on demand in local development will increase the number of browser requests by around 20%.
// This may slow down the browser refresh speed.
// Therefore, only enable on-demand importing in production environments .
if (import.meta.env.DEV) {
  import('ant-design-vue/dist/antd.less');
}

async function bootstrap() {
  const app = createApp(App);

  // 安装挂载store仓库
  setupStore(app);

  // 初始化应用配置仓库
  initAppConfigStore();

  // 注册全局组件
  registerGlobComp(app);

  // 多语言配置初始化
  // 异步案例:语言文件可以从服务器端获取
  await setupI18n(app);

  // 配置挂载路由
  setupRouter(app);

  // 初始化导航路由守卫
  setupRouterGuard(router);

  // 注册全局自定义指令
  setupGlobDirectives(app);

  // 配置全局错误处理 主要是分类各种错误日志并收集
  setupErrorHandle(app);

  // https://next.router.vuejs.org/api/#isready
  // await router.isReady();

  app.mount('#app');
}

bootstrap();
