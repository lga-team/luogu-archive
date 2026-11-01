# 前端

基于 Nuxt 3 / Vue 3 / TypeScript 重写的洛谷档案馆界面，视觉与组件遵循 Fluent 2。

## 技术栈

- **UI**：[@fluentui/web-components](https://www.npmjs.com/package/@fluentui/web-components) v3 + Fluent design tokens（`assets/css/fluent-tokens.css`）。
- **图标**：全部使用 [lucide](https://lucide.dev/)（`lucide-vue-next`），包括原本由 Fluent 控件内部绘制的 chevron / checkmark。
- **Markdown**：继续使用 `@luogu-saver-next/markdown-renderer`，入口见 `composables/useMarkdown.ts`。
- **布局**：桌面为左侧图标栏（可访问的 `aria-label` / `title`），移动端为底部导航 + 上拉菜单。
- **SSR**：页面内容、统计与 Markdown 走 SSR；Fluent 自定义元素在客户端升级。
  会修改 light DOM 的复杂控件在客户端挂载（见 `components/f/Select.vue`），以保证 hydration 稳定。

## 本地运行

```sh
pnpm install --frozen-lockfile
pnpm dev       # 开发
pnpm build     # 生产构建
pnpm preview   # 预览构建
```

> Windows 上如果 pnpm 的 junction 布局导致 CLI 解析失败，仓库已配置 `node-linker=hoisted`（`.npmrc`）。

## 后端地址

浏览器端通过 `NUXT_PUBLIC_API_BASE_URL` 配置；留空时使用同源 `/api/v1`（由反向代理转发）。
可以填写源站、`/api` 或 `/api/v1`，`composables/useApiBase.ts` 会自动归一化，最终请求 `<源站>/api/v1/...`。

服务端 SSR 通过 `NUXT_API_INTERNAL_URL` 配置，默认 `http://127.0.0.1:8001`，与原版仓库一致。

跨域后端使用 Bearer token，并对 `Access-Control-Allow-Origin: *` 的后端关闭 Cookie
（浏览器禁止通配符 + credentials 组合）。同源部署时自动恢复 `credentials: include`。
登录 token 会写入 `sessionStorage`，同一标签页刷新可恢复。

## 目录

```text
components/f/        Fluent 控件的 Vue 适配（Button / Input / Select / Dialog / Tabs ...）
components/          页面级组件（首页、文档、设置、插件、用户等）
composables/         API、Markdown、时间、导航、插件标签等
layouts/             default（前台侧边栏）与 admin（后台侧边栏）
pages/               全部路由
assets/css/          app.css（Fluent 2 应用层）与自动生成的 tokens
```

## 设计约定

- 颜色、间距、字体、圆角、阴影一律使用 `--color* / --spacing* / --font* / --borderRadius* / --shadow*` token。
- 页面结构优先使用 `:root` 中的 `.page`、`.card`、`.section-head`、`.grid`、`.table`、`.markdown-body` 等公共类。
- 移动端断点为 900px / 680px / 420px；表格使用横向滚动容器，正文与表单不产生页面级横向溢出。
- 新图标不要引入 SVG 文件，统一从 `lucide-vue-next` 导入。
