<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'

const api = useApi()
const auth = useAuthStore()
const route = useRoute()

// 登录后只允许跳回本站路径，避免 redirect 参数被利用成开放重定向。
const safeRedirect = computed(() => {
  const value = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  return value.startsWith('/') && !value.startsWith('//') ? value : '/'
})

const needVerify = ref(false)
const serverError = ref('')
const resendMsg = ref('')
const resendCooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

const { handleSubmit, isSubmitting, values } = useForm({
  validationSchema: toTypedSchema(z.object({
    email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
    password: z.string().min(1, '请输入密码'),
  })),
  initialValues: { email: '', password: '' },
})

const onSubmit = handleSubmit(async (formValues) => {
  serverError.value = ''
  needVerify.value = false
  resendMsg.value = ''
  try {
    const data = await api<any>('/auth/login', {
      method: 'POST',
      body: formValues,
    })
    auth.setTokens(data)
    await navigateTo(safeRedirect.value)
  } catch (e: any) {
    serverError.value = e?.data?.message || '登录失败'
    // 后端对未验证邮箱返回"请先验证邮箱"
    if (typeof serverError.value === 'string' && serverError.value.includes('验证邮箱')) {
      needVerify.value = true
    }
  }
})

function startCooldown(sec: number) {
  resendCooldown.value = sec
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

async function resend() {
  if (resendCooldown.value > 0) return
  if (!values.email) {
    toast.warning('请先填写邮箱')
    return
  }
  resendMsg.value = ''
  try {
    const data = await api<{ message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: { email: values.email },
    })
    resendMsg.value = data.message || '已重新发送，请查收'
    toast.success('验证邮件已发送')
    startCooldown(60)
  } catch (e: any) {
    const retry = e?.data?.data?.retry_after_sec
    resendMsg.value = e?.data?.message || '发送失败'
    toast.error(resendMsg.value)
    if (typeof retry === 'number' && retry > 0) startCooldown(retry)
  }
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

useHead({ title: '登录 - 洛谷档案馆' })

</script>

<template>
  <div class="mx-auto w-full max-w-[380px] py-10 sm:py-16">
    <div class="mb-6 text-center">
      <img src="/favicon.png" alt="" class="mx-auto mb-4 size-12 rounded-xl">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">
        登录
      </h1>
      <p class="mt-1.5 text-sm text-muted-foreground">
        登录后可以关注内容、追踪版本变化
      </p>
    </div>

    <Card class="gap-0 py-0">
      <CardContent class="p-6">
        <form class="flex flex-col gap-4" @submit="onSubmit">
          <FormField v-slot="{ componentField }" name="email">
            <FormItem>
              <FormLabel>邮箱</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autocomplete="email"
                  placeholder="you@example.com"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="password">
            <FormItem>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autocomplete="current-password"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <Alert v-if="serverError" variant="destructive" class="px-3 py-2">
            <AlertDescription class="text-sm">
              {{ serverError }}
            </AlertDescription>
          </Alert>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? '登录中...' : '登录' }}
          </Button>
        </form>

        <div v-if="needVerify" class="mt-4 rounded-lg border border-border bg-muted/60 p-3">
          <p class="text-sm text-muted-foreground">
            邮箱还没验证？
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="mt-2 w-full"
            :disabled="resendCooldown > 0"
            @click="resend"
          >
            {{ resendCooldown > 0 ? `重新发送（${resendCooldown}s）` : '重新发送验证邮件' }}
          </Button>
          <p v-if="resendMsg" class="mt-2 text-xs text-muted-foreground">
            {{ resendMsg }}
          </p>
        </div>
      </CardContent>
    </Card>

    <p class="mt-6 text-center text-sm text-muted-foreground">
      还没账号？
      <NuxtLink to="/register" class="font-medium text-primary hover:underline">
        注册
      </NuxtLink>
    </p>
  </div>
</template>
