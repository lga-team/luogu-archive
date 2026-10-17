# 前端

架构：Nuxt 3、Vue 3、TypeScript、Pinia。
新版 UI 使用本地适配的 shadcn-vue / Reka UI 组件；没有 React 运行时或 Vue/React 桥接层。
设计与组件规则见 [components/ui/README.md](components/ui/README.md)。

- pnpm install --frozen-lockfile：安装锁定依赖。
- pnpm dev：开发预览。
- pnpm build：生产构建。
- pnpm exec vue-tsc --noEmit：类型检查。

现有路由、API、登录、验证码、统计及主题存储保持不变。
旧页面的设计单独迁移，统一框架不意味着统一修改旧页面外观。
