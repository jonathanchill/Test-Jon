<script setup lang="ts">
const { data: status, refresh } = await useFetch<any>('/api/status')
provide('status', status)
provide('refreshStatus', refresh)
let timer: ReturnType<typeof setInterval>
onMounted(() => { timer = setInterval(refresh, 15000) })
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div>
    <div v-if="status?.dataMode === 'demo'" class="banner">
      Demo mode. Every channel and number on these screens is invented, and scores come from keyword matching, not Claude. Nothing here can go to a client.
    </div>
    <header class="topbar">
      <div class="wrap">
        <NuxtLink to="/" class="brand">Creator research</NuxtLink>
        <NuxtLink to="/">Briefs</NuxtLink>
        <NuxtLink to="/briefs/new">New brief</NuxtLink>
        <NuxtLink to="/setup">Set-up and rules</NuxtLink>
        <span class="spacer" />
        <span v-if="status" class="small muted">
          YouTube searches today: <b>{{ status.youtube.searches.used }} / {{ status.youtube.searches.limit }}</b>
          &nbsp;·&nbsp; lookups: <b>{{ num(status.youtube.units.used) }} / {{ num(status.youtube.units.limit) }}</b>
          &nbsp;·&nbsp; signed in as <b>{{ status.you }}</b>
        </span>
      </div>
    </header>
    <main class="wrap">
      <NuxtPage />
    </main>
  </div>
</template>
