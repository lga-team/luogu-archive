# UI Components

本站统一使用 Nuxt + Vue 3 + TypeScript。新版组件按 shadcn-vue 的组合方式适配，
交互基础使用 Reka UI，图标使用 lucide-vue-next；不再挂载 React。
参考：https://www.shadcn-vue.com/docs/components
参考：https://www.reka-ui.com/docs/overview/introduction

## 组件与样式

优先复用本目录的 Button、Input、Dialog、Tabs、RadioGroup、Switch、Slider 等组件。
页面从 ~/components/ui 显式导入。只添加实际需要的组件，不自动覆盖目录或全量安装组件库。
保留 MIT 来源声明。

新版页面根节点使用 .archive-ui，公共样式位于 assets/css/archive.css。
旧页面不替换控件、不添加全局样式重置。新版页面默认纯色背景；洛谷主题仅影响亮色新版页面，
暗色保持纯色。所有外观沿用本站 CSS 变量，不因组件迁移重新设计。

不要以整页 loading 替换页面；标题、操作栏正常显示，数据区域独立处理加载、错误和空状态。
主页保留现有组件一起显示的行为，不添加整页 loading。
按钮尺寸固定，图标按钮有名称或提示，长文本和窄屏不能挤出页面。

## 职责边界

pages 负责路由与页面组装；components 负责界面与交互；
composables 负责可复用的请求、刷新和状态逻辑；utils 保存纯函数；
stores 仅存放确实需要跨页面共享的状态。
不要为了拆分而增加无用包装层。

使用 ArchiveUpdateButton 显示新版更新操作。请求、人机验证和权限检查由页面或 SaveButton 负责；
按钮负责固定尺寸、两秒反馈、动画及失败弹窗。GET 刷新不能显示“任务派发成功”。
分页统一使用 ArchivePagination；它负责十页滑动窗口与首尾翻页，页面负责请求及跳转。
游标“加载更多”不改成数字分页。

## 主题

主题编辑器位于 components/settings/ThemeEditor.vue，草稿和导入流程位于 useThemeEditor。
只编辑亮色；离开编辑器恢复已保存配置。只在用户明确导入时访问指定主题，不自动刷新。
导入使用 POST /api/v1/themes/import 和 GET /api/v1/themes/{id}，
依赖后端迁移 20261016_0017。存储键 archive-luogu-theme-v1 保持兼容。

## 验证

pnpm build
pnpm exec vue-tsc --noEmit

迁移组件时同时检查键盘操作、弹窗焦点与恢复、手机布局、浅色、深色和自定义主题。
不要留下临时测试脚本。
