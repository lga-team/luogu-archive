<script setup lang="ts">
useHead({ title: '登录 - 洛谷档案馆' })
</script>

<template>
  <div class="login-page">
    <h1>登录</h1>
    <AccountLoginForm />
  </div>
</template>

<style scoped>
.login-page { max-width: 400px; margin: 40px auto; }
.login-page h1 { font-size: 28px; margin: 0 0 20px; }
</style>
