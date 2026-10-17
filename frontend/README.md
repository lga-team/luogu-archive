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

## Markdown

站内 Markdown 统一通过 `useMarkdown().render` 使用 `@luogu-saver-next/markdown-renderer` 1.0.3（MIT）。
渲染器在浏览器按需加载，异步结果通过响应式缓存更新；调用方仍获取 HTML 字符串，不获取 Promise。
首次渲染前及 SSR 阶段正文留空；原始 Markdown、历史版本与复制原文不变。
HTML 原文按语法树转义，渲染结果再经过 DOMPurify；只允许哔哩哔哩播放器嵌入。
题目链接保持跳转洛谷，不改写为站内地址。编辑器、公告、历史版本及后台预览复用同一入口。
该依赖使用独立 MIT 许可证，不改变本项目许可证。

## 本地连接主站

配置仅本机使用的 .env.preview.local 后运行 pnpm dev:preview，访问 http://localhost:3002。
ARCHIVE_PREVIEW_UPSTREAM 设置浏览器 API 和图片资源的代理目标；
NUXT_API_INTERNAL_URL 设置服务端 API 地址，NUXT_PUBLIC_API_BASE_URL 留空。
代理仅在 Nuxt 开发模式生效，不启动本地后端、队列或数据库。
完整操作会修改主站真实数据；本地需单独登录，并使用 localhost 地址访问。
验证码可能要求在服务商侧允许 localhost，不要通过关闭后端验证来绕过。
