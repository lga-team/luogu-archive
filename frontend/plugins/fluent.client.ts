/**
 * Fluent UI Web Components (v3) 注册。
 *
 * 只注册实际使用的组件，避免把整套组件库塞进首屏 bundle。
 * 控件在客户端升级；SSR 阶段输出语义结构与 Fluent token 样式，
 * 属于 Fluent v3 支持的“部分 SSR”（声明式模板见各组件的 template.html）。
 *
 * 注意：原生 select、链接与所有图标统一使用 lucide；
 * 不依赖 Fluent 组件内部的 SVG 图标。
 */
import '@microsoft/focusgroup-polyfill'

import '@fluentui/web-components/avatar/define.js'
import '@fluentui/web-components/badge/define.js'
import '@fluentui/web-components/button/define.js'
import '@fluentui/web-components/checkbox/define.js'
import '@fluentui/web-components/dialog/define.js'
import '@fluentui/web-components/dialog-body/define.js'
import '@fluentui/web-components/drawer/define.js'
import '@fluentui/web-components/drawer-body/define.js'
import '@fluentui/web-components/divider/define.js'
import '@fluentui/web-components/label/define.js'
import '@fluentui/web-components/radio/define.js'
import '@fluentui/web-components/radio-group/define.js'
import '@fluentui/web-components/slider/define.js'
import '@fluentui/web-components/spinner/define.js'
import '@fluentui/web-components/switch/define.js'
import '@fluentui/web-components/tab/define.js'
import '@fluentui/web-components/tablist/define.js'
import '@fluentui/web-components/textarea/define.js'
import '@fluentui/web-components/text-input/define.js'

export default defineNuxtPlugin(() => {})
