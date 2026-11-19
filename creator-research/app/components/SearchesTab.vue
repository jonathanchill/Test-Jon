<script setup lang="ts">
const props = defineProps<{ brief: any, tick: number }>()
const emit = defineEmits<{ changed: [] }>()
const status = inject<Ref<any>>('status')!
const rows = ref<any[]>([])
const error = ref('')
const form = reactive({ kind: 'niche', term: '', niche: props.brief.niches[0] ?? '', region: props.brief.countries[0] ?? 'GB', language: props.brief.languages[0] ?? 'en' })

async function load() { rows.value = await $fetch<any[]>(`/api/briefs/${props.brief.id}/searches`) }
watch(() => props.tick, load)
onMounted(load)

async function add() {
  error.value = ''
  try {
    await $fetch(`/api/briefs/${props.brief.id}/searches`, { method: 'POST', body: form })
    form.term = ''
    await load()
    emit('changed')
  } catch (e) { error.value = errorText(e) }
}
async function remove(id: number) {
  error.value = ''
  try {
    await $fetch(`/api/searches/${id}`, { method: 'DELETE' })
    await load()
    emit('changed')
  } catch (e) { error.value = errorText(e) }
}
const queued = computed(() => rows.value.filter(r => r.status === 'queued').length)
const days = computed(() => status.value ? Math.ceil(queued.value / Math.max(1, status.value.youtube.searches.limit)) : null)
</script>

<template>
  <div>
    <p class="muted" style="margin-top: 14px">
      Product searches run first, then each niche in each country and language. Every search is kept, so you can see which one found which creator.
      <span v-if="queued && days"> <b>{{ queued }} searches are waiting</b>: about {{ days }} day{{ days === 1 ? '' : 's' }} at {{ status.youtube.searches.limit }} searches a day.</span>
    </p>
    <form class="panel row" @submit.prevent="add">
      <b>Add a search</b>
      <select v-model="form.kind" style="width: auto" aria-label="Kind"><option value="niche">Niche</option><option value="product">Product</option></select>
      <input v-model="form.term" type="text" required placeholder="e.g. test console rétro portable" style="width: 280px" aria-label="Search term">
      <select v-if="form.kind === 'niche'" v-model="form.niche" style="width: auto" aria-label="Niche"><option v-for="n in brief.niches" :key="n" :value="n">{{ n }}</option></select>
      <select v-model="form.region" style="width: auto" aria-label="Country"><option v-for="c in brief.countries" :key="c" :value="c">{{ countryName(c) }}</option></select>
      <select v-model="form.language" style="width: auto" aria-label="Language"><option v-for="l in brief.languages" :key="l" :value="l">{{ l }}</option></select>
      <button type="submit">Add</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Search term</th><th>Kind</th><th>Country</th><th>Language</th><th>Written by</th><th>Status</th><th class="num">Videos</th><th class="num">New channels</th><th>Run</th><th /></tr></thead>
        <tbody>
          <tr v-for="s in rows" :key="s.id">
            <td><b>{{ s.term }}</b><div v-if="s.niche && s.niche !== s.term" class="small muted">{{ s.niche }}</div><div v-if="s.error" class="badline">{{ s.error }}</div></td>
            <td>{{ s.kind }}</td><td>{{ countryName(s.region) }}</td><td>{{ s.language }}</td>
            <td>{{ s.term_source === 'claude' ? 'Claude' : s.term_source === 'person' ? 'a person' : 'the brief' }}</td>
            <td><span class="pill" :class="{ good: s.status === 'done', bad: s.status === 'failed' }">{{ s.status === 'queued' ? 'waiting' : s.status }}</span></td>
            <td class="num">{{ s.result_count ?? '' }}</td><td class="num">{{ s.new_channels ?? '' }}</td>
            <td class="nowrap">{{ s.run_at ? date(s.run_at) : '' }}</td>
            <td><button v-if="s.status === 'queued'" class="tiny" @click="remove(s.id)">Remove</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
