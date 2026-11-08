import { initSafeHtml } from '../lib/safeHtml'

export default defineNuxtPlugin(async () => {
  await initSafeHtml()
})
