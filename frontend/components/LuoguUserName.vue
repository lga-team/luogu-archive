<!--
  用户名显示（带颜色 + 称号 + 钩子 + 气球 + 违规脱敏）

  props:
    user: { uid, name, color, badge, avatar, ccf_level?, xcpc_level?, is_admin? }
    hidden: boolean   后端指示"当前名被隐藏"时为 true
    showBadge: boolean   是否显示称号 / 钩子 / 气球
    noLink: boolean   为 true 时不包链接（避免在用户主页自己链自己）

  显示顺序（与洛谷一致）：用户名 → 称号 → 钩子 → 气球
  显示规则（钩子气球颜色规则相同）：
    钩子 ccf_level：0-2 不显示，3-5 绿，6-7 蓝，8+ 金
    气球 xcpc_level：0-2 不显示，3-5 绿，6-7 蓝，8+ 金
    称号 badge 颜色 = 用户名颜色（背景填充 + 白字）
-->
<script setup lang="ts">
import { Award, BadgeCheck } from 'lucide-vue-next'

interface LuoguUserBrief {
  uid: number
  name: string
  color: string
  badge: string | null
  avatar: string | null
  ccf_level?: number
  xcpc_level?: number
  is_admin?: boolean
}

const props = defineProps<{
  user: LuoguUserBrief | null | undefined
  hidden?: boolean
  showBadge?: boolean
  noLink?: boolean
}>()

const displayName = computed(() => {
  if (!props.user) return ''
  return props.hidden ? `UID ${props.user.uid}` : props.user.name
})

function levelTier(lv: number | undefined): 'green' | 'blue' | 'top' | null {
  if (!lv || lv < 3) return null
  if (lv <= 5) return 'green'
  if (lv <= 7) return 'blue'
  return 'top'
}

const ccfTier = computed(() => levelTier(props.user?.ccf_level))
const xcpcTier = computed(() => levelTier(props.user?.xcpc_level))

// 棕名（Cheater）默认带"作弊者"称号；后端没返回 badge 时本地补上
const effectiveBadge = computed<string | null>(() => {
  if (!props.user) return null
  if (props.user.badge) return props.user.badge
  if (props.user.color === 'Cheater') return '作弊者'
  return null
})
</script>

<template>
  <span v-if="user" class="lg-user-wrap">
    <NuxtLink
      v-if="!noLink"
      :to="`/user/${user.uid}`"
      class="lg-name"
      :data-color="user.color"
      :data-hidden="hidden ? '1' : undefined"
    >{{ displayName }}</NuxtLink>
    <span
      v-else
      class="lg-name"
      :data-color="user.color"
      :data-hidden="hidden ? '1' : undefined"
    >{{ displayName }}</span>

    <template v-if="showBadge">
      <!-- 称号：背景为用户名颜色，文字白色（棕名无 badge 时本地补"作弊者"） -->
      <span
        v-if="effectiveBadge"
        class="lg-badge"
        :data-color="user.color"
        :title="user.is_admin ? '管理员' : ''"
      >{{ effectiveBadge }}</span>

      <!-- 钩子（OI 认证）：fa-badge-check（双色：彩盾 + 白勾） -->
      <span
        v-if="ccfTier"
        class="lg-mark lg-hook"
        :data-tier="ccfTier"
        :title="`OI 认证等级 ${user.ccf_level}`"
        aria-label="钩子"
      >
        <BadgeCheck :size="14" :stroke-width="2.2" aria-hidden="true" />
      </span>

      <!-- 气球（XCPC 认证）：fa-balloon（双色：彩气球 + 白高光） -->
      <span
        v-if="xcpcTier"
        class="lg-mark lg-balloon"
        :data-tier="xcpcTier"
        :title="`XCPC 认证等级 ${user.xcpc_level}`"
        aria-label="气球"
      >
        <Award :size="13" :stroke-width="2.2" aria-hidden="true" />
      </span>
    </template>
  </span>
</template>

<style scoped>
.lg-name { color: var(--colorNeutralForeground1); text-decoration: none; font-weight: 600; }
.lg-name:hover { color: var(--colorBrandForegroundLink); text-decoration: none; }
.lg-name[data-hidden="1"] { color: var(--colorNeutralForeground3) !important; font-weight: 500; }
.lg-name[data-color="Blue"] { color: var(--lg-blue); }
.lg-name[data-color="Green"] { color: var(--lg-green); }
.lg-name[data-color="Orange"] { color: var(--lg-orange); }
.lg-name[data-color="Red"] { color: var(--lg-red-name, #FE4C61); }
.lg-name[data-color="Purple"] { color: var(--lg-purple); }
.lg-name[data-color="Cyan"] { color: #13C2C2; }
.lg-name[data-color="Black"] { color: var(--lg-black); }
.lg-name[data-color="Gray"] { color: var(--lg-gray); }
.lg-name[data-color="Cheater"] { color: var(--lg-brown); }
.lg-badge {
  display: inline-flex; align-items: center; padding: 0 5px; border-radius: var(--borderRadiusSmall);
  background: var(--lg-gray); color: #fff; font-size: 10.5px; line-height: 16px; font-weight: 500; white-space: nowrap;
}
.lg-badge[data-color="Blue"] { background: var(--lg-blue); }
.lg-badge[data-color="Green"] { background: var(--lg-green); }
.lg-badge[data-color="Orange"] { background: var(--lg-orange); }
.lg-badge[data-color="Red"] { background: #FE4C61; }
.lg-badge[data-color="Purple"] { background: var(--lg-purple); }
.lg-badge[data-color="Cyan"] { background: #13C2C2; }
.lg-badge[data-color="Black"] { background: var(--lg-black); }
.lg-badge[data-color="Gray"] { background: var(--lg-gray); }
.lg-badge[data-color="Cheater"] { background: var(--lg-brown); }

.lg-user-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: middle;
  flex-wrap: wrap;
  max-width: 100%;
}

/* 钩子 / 气球：以 currentColor 上色 */
.lg-mark {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.lg-mark[data-tier="green"] { color: var(--lg-green); }
.lg-mark[data-tier="blue"]  { color: var(--lg-blue); }

/* 钩子 / 气球 8+ 都是金 —— 规则跟洛谷一致：3-5 绿、6-7 蓝、8+ 金 */
.lg-mark[data-tier="top"] { color: #FFC116; }
</style>

