<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const refreshStatus = inject<() => void>('refreshStatus')!

const { data: brief, refresh: refreshBrief, error: loadError } = await useFetch<any>(`/api/briefs/${id}`)
const { data: counts, refresh: refreshCounts } = await useFetch<any>(`/api/briefs/${id}/counts`)
const tab = ref((route.query.tab as string) || 'review')
watch(tab, t => router.replace({ query: { ...route.query, tab: t } }))
const tick = ref(0) // bumps when the run makes progress, so tabs reload
const busy = ref(false)
const error = ref('')

const active = computed(() => ['running', 'waiting_quota'].includes(brief.value?.status))
let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(async () => {
    if (!active.value) return
    await Promise.all([refreshBrief(), refreshCounts()])
    refreshStatus()
    tick.value++
  }, 4000)
})
onBeforeUnmount(() => clearInterval(timer))

async function act(path: string, confirmText?: string) {
  if (confirmText && !window.confirm(confirmText)) return
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/briefs/${id}/${path}`, { method: 'POST', body: {} })
    await Promise.all([refreshBrief(), refreshCounts()])
    tick.value++
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
async function changed() {
  await refreshCounts()
}
const approved = computed(() => counts.value?.byStatus.find((s: any) => s.status === 'approved')?.count ?? 0)
</script>

<template>
  <div v-if="loadError" class="error" style="margin-top: 20px">Brief not found.</div>
  <div v-else-if="brief">
    <div class="row" style="margin-top: 20px; align-items: flex-start">
      <div style="flex: 1; min-width: 260px">
        <h1>{{ brief.client }}: {{ brief.name }}</h1>
        <p class="muted small">
          {{ brief.countries.map(countryName).join(', ') }} · {{ brief.languages.join(', ') }} ·
          {{ num(brief.follower_min) }}{{ brief.follower_max ? ` to ${num(brief.follower_max)}` : '+' }} followers ·
          niches: {{ brief.niches.join(', ') }}
        </p>
      </div>
      <span class="pill" :class="{ good: brief.status === 'complete', info: brief.status === 'running', warn: brief.status === 'waiting_quota' }">{{ STATUS_LABEL[brief.status] }}</span>
      <button v-if="brief.status === 'draft'" class="primary" :disabled="busy" @click="act('start')">Start the search</button>
      <button v-if="brief.status === 'paused'" class="primary" :disabled="busy" @click="act('start')">Resume</button>
      <button v-if="active" :disabled="busy" @click="act('pause')">Pause</button>
      <button v-if="brief.status === 'complete'" :disabled="busy" title="Pull fresh follower and view numbers" @click="act('recheck', 'Pull fresh numbers for every creator on this brief? Reviews and edited scores are kept.')">Re-check numbers</button>
    </div>
    <p v-if="brief.status_note" class="note" :class="{ warn: brief.status === 'waiting_quota' }">{{ brief.status_note }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="counts" class="stats">
      <div class="stat"><b>{{ counts.searches.done }} / {{ counts.searches.total }}</b><span>searches run</span></div>
      <div class="stat"><b>{{ num(counts.funnel.channelsFound) }}</b><span>channels found</span></div>
      <div class="stat"><b>{{ num(counts.funnel.inRange) }}</b><span>in the follower range</span></div>
      <div class="stat"><b>{{ num(counts.funnel.scored) }}</b><span>scored</span></div>
      <div class="stat"><b>{{ num(counts.fit) }}</b><span>fit the brief (score {{ counts.minScore }}+)</span></div>
      <div class="stat"><b>{{ num(approved) }}</b><span>approved by a person</span></div>
    </div>

    <nav class="tabs">
      <button :class="{ active: tab === 'review' }" @click="tab = 'review'">Review list</button>
      <button :class="{ active: tab === 'count' }" @click="tab = 'count'">The count</button>
      <button :class="{ active: tab === 'searches' }" @click="tab = 'searches'">Searches</button>
      <button :class="{ active: tab === 'unchecked' }" @click="tab = 'unchecked'">Not checked</button>
      <button :class="{ active: tab === 'export' }" @click="tab = 'export'">Export</button>
    </nav>

    <ReviewTab v-if="tab === 'review'" :brief="brief" :tick="tick" @changed="changed" />
    <CountTab v-else-if="tab === 'count'" :brief="brief" :tick="tick" />
    <SearchesTab v-else-if="tab === 'searches'" :brief="brief" :tick="tick" @changed="() => { refreshBrief(); refreshCounts() }" />
    <UncheckedTab v-else-if="tab === 'unchecked'" :brief="brief" :counts="counts" :tick="tick" />
    <ExportTab v-else-if="tab === 'export'" :brief="brief" :approved="approved" :tick="tick" @rescored="() => { refreshBrief(); refreshCounts() }" />
  </div>
</template>
