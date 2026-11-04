import { defineConfig } from 'vitepress'
import markdownItKatex from '@vscode/markdown-it-katex'
import footnote from 'markdown-it-footnote'

const katexPlugin = typeof markdownItKatex === 'function'
  ? markdownItKatex
  : (markdownItKatex as unknown as { default: typeof markdownItKatex }).default

export default defineConfig({
  lang: 'zh-CN',
  title: '洛谷档案馆文档',
  description: '洛谷档案馆使用文档',
  base: '/docs/',
  srcDir: './content',
  cleanUrls: true,
  appearance: true,
  vite: {
    // 文档站独立使用样式配置，避免向上读取主项目的配置文件。
    css: { postcss: {} },
  },
  head: [
    ['link', { rel: 'icon', href: '/docs/favicon.png' }],
    ['meta', { name: 'robots', content: 'noindex, nofollow, noarchive' }],
  ],
  markdown: {
    config(md) {
      md.use(katexPlugin, { throwOnError: false, enableBareBlocks: true })
      md.use(footnote)
    },
  },
  themeConfig: {
    logo: '/favicon.png',
    siteTitle: '洛谷档案馆文档',
    nav: [
      { text: '文档', link: '/' },
      { text: '返回档案馆', link: 'https://www.luogu.ac.cn/' },
    ],
    sidebar: [
      {
        text: '开始使用',
        items: [
          { text: '欢迎页', link: '/' },
          { text: '快速上手', link: '/quick-start' },
          { text: '常见问题', link: '/faq' },
        ],
      },
      // 指南和政策分组默认收起，点击小三角即可展开。
      {
        text: '插件指南',
        collapsed: true,
        items: [
          { text: '上传须知', link: '/plugin/upload' },
          { text: '推荐须知', link: '/plugin/recommend' },
          { text: '使用须知', link: '/plugin/usage' },
        ],
      },
      {
        text: '政策与声明',
        collapsed: true,
        items: [
          { text: '隐私协议', link: '/policies/privacy' },
          { text: '免责声明', link: '/policies/disclaimer' },
          { text: '数据移除政策', link: '/policies/data-removal' },
        ],
      },
    ],
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    sidebarMenuLabel: '目录',
    returnToTopLabel: '返回顶部',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换浅色模式',
    darkModeSwitchTitle: '切换深色模式',
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                displayDetails: '显示详细结果',
                resetButtonTitle: '清空搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有找到相关内容',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
        },
      },
    },
    footer: { message: '第三方存档，与洛谷官方无关。' },
  },
})
