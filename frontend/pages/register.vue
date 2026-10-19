<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { CircleCheck } from '@lucide/vue'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'

const api = useApi()

const state = ref<'idle' | 'done'>('idle')
const serverError = ref('')
const captchaRef = ref<any>(null)

const { handleSubmit, isSubmitting, values } = useForm({
  validationSchema: toTypedSchema(
    z.object({
      email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
      display_name: z.string().min(1, '请输入显示名').max(16, '最多 16 个字符'),
      password: z
        .string()
        .min(8, '至少 8 位')
        .regex(/[A-Za-z]/, '需包含字母')
        .regex(/\d/, '需包含数字'),
      passwordConfirm: z.string().min(1, '请再次输入密码'),
    }).refine(value => value.password === value.passwordConfirm, {
      message: '两次输入的密码不一致',
      path: ['passwordConfirm'],
    }),
  ),
  initialValues: { email: '', display_name: '', password: '', passwordConfirm: '' },
})

const onSubmit = handleSubmit(async (formValues) => {
  serverError.value = ''
  try {
    const captchaToken = await captchaRef.value?.getToken?.()
    await api('/auth/register', {
      method: 'POST',
      body: {
        email: formValues.email,
        display_name: formValues.display_name,
        password: formValues.password,
        captcha_token: captchaToken || undefined,
      },
    })
    toast.success('注册成功，请查收验证邮件')
    state.value = 'done'
  } catch (e: any) {
    serverError.value = e?.data?.message || '注册失败'
    toast.error(serverError.value)
    captchaRef.value?.reset?.()
  }
})

useHead({ title: '注册 - 洛谷档案馆' })

</script>

<template>
  <div class="mx-auto w-full max-w-[400px] py-10 sm:py-14">
    <div class="mb-6 text-center">
      <img src="/favicon.png" alt="" class="mx-auto mb-4 size-12 rounded-xl">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">
        注册
      </h1>
      <p class="mt-1.5 text-sm text-muted-foreground">
        注册后可以关注内容、追踪版本变化
      </p>
    </div>

    <Card class="gap-0 py-0">
      <CardContent class="p-6">
        <form v-if="state === 'idle'" class="flex flex-col gap-4" @submit="onSubmit">
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

          <FormField v-slot="{ componentField }" name="display_name">
            <FormItem>
              <FormLabel>显示名</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  maxlength="16"
                  placeholder="1-16 个字符"
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
                  autocomplete="new-password"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
              <p class="text-xs text-muted-foreground">
                至少 8 位，需包含字母和数字
              </p>
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="passwordConfirm">
            <FormItem>
              <FormLabel>确认密码</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autocomplete="new-password"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <CaptchaChallenge ref="captchaRef" id-suffix="register" />

          <Alert v-if="serverError" variant="destructive" class="px-3 py-2">
            <AlertDescription class="text-sm">
              {{ serverError }}
            </AlertDescription>
          </Alert>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? '提交中...' : '注册' }}
          </Button>
        </form>

        <div v-else class="flex flex-col items-center py-4 text-center">
          <CircleCheck class="size-10 text-emerald-500" />
          <h2 class="mt-3 text-base font-semibold text-foreground">
            已发送验证邮件
          </h2>
          <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            请到 {{ values.email }} 的邮箱查收，24 小时内点击验证链接即可登录。
          </p>
          <Button variant="outline" size="sm" as-child class="mt-4">
            <NuxtLink to="/login">返回登录</NuxtLink>
          </Button>
        </div>
      </CardContent>
    </Card>

    <p class="mt-6 text-center text-sm text-muted-foreground">
      已有账号？
      <NuxtLink to="/login" class="font-medium text-primary hover:underline">
        登录
      </NuxtLink>
    </p>
  </div>
</template>
