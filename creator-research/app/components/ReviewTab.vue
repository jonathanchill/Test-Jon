<script setup lang="ts">
const props = defineProps<{ brief: any, tick: number }>()
const emit = defineEmits<{ changed: [] }>()

const filters = reactive({ q: '', country: '', niche: '', band: '', minScore: '', status: '' })
const rows = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const selected = ref<Set<number>>(new Set())
const openId = ref<number | null>(null)

const BANDS = [
  { key: '10k_50k', label: '10,000 to 50,000' }, { key: '50k_250k', label: '50,000 to 250,000' },
  { key: '250k_1m', label: '250,000 to 1 million' }, { key: 'over_1m', label: 'Over 1 million' }, { key: 'under_10k', label: 'Under 10,000' },
]

async function load() {
  try {
    rows.value = await $fetch<any[]>(`/api/briefs/${props.brief.id}/creators`, { query: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) })
    error.value = ''
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loading.value = false
  }
}
let debounce: ReturnType<typeof setTimeout>
watch(filters, () => { clearTimeout(debounce); debounce = setTimeout(load, 200) })
watch(() => props.tick, load)
onMounted(load)

const countries = computed(() => [...new Set(rows.value.map(r => r.country).filter(Boolean))].sort())
const allSelected = computed(() => rows.value.length > 0 && rows.value.every(r => selected.value.has(r.creator_id)))
function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(rows.value.map(r => r.creator_id))
}
function toggle(id: number) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}

async function setStatus(row: any, status: string) {
  error.value = ''
  try {
    await $fetch(`/api/briefs/${props.brief.id}/creators/${row.creator_id}`, { method: 'PATCH', body: { status: row.status === status ? 'found' : status } })
    await load()
    emit('changed')
  } catch (e) {
    error.value = errorText(e)
  }
}
async function bulk(status: string) {
  error.value = ''
  try {
    const res = await $fetch<{ done: number, blocked: number[] }>(`/api/briefs/${props.brief.id}/creators/bulk`, { method: 'POST', body: { ids: [...selected.value], status } })
    if (res.blocked.length) error.value = `${res.blocked.length} flagged creator(s) were skipped. Open each one to clear the flag first.`
    selected.value = new Set()
    await load()
    emit('changed')
  } catch (e) {
    error.value = errorText(e)
  }
}
async function closed(changed: boolean) {
  openId.value = null
  if (changed) { await load(); emit('changed') }
}
</script>

<template>
  <div>
    <div class="row filters" style="margin: 14px 0">
      <input v-model="filters.q" type="search" placeholder="Search by name" aria-label="Search by name">
      <select v-model="filters.country" aria-label="Country">
        <option value="">All countries</option>
        <option v-for="c in brief.countries" :key="c" :value="c">{{ countryName(c) }}</option>
        <option v-for="c in countries.filter(c => !brief.countries.includes(c))" :key="c" :value="c">{{ countryName(c) }}</option>
        <option value="unknown">Unknown</option>
      </select>
      <select v-model="filters.niche" aria-label="Niche">
        <option value="">All niches</option>
        <option v-for="n in brief.niches" :key="n" :value="n">{{ n }}</option>
      </select>
      <select v-model="filters.band" aria-label="Size">
        <option value="">All sizes</option>
        <option v-for="b in BANDS" :key="b.key" :value="b.key">{{ b.label }}</option>
      </select>
      <select v-model="filters.minScore" aria-label="Fit score">
        <option value="">Any fit score</option>
        <option v-for="s in [5, 4, 3, 2]" :key="s" :value="s">{{ s === 5 ? 'Fit 5 only' : `Fit ${s} or higher` }}</option>
      </select>
      <select v-model="filters.status" aria-label="Review status">
        <option value="">Any review status</option>
        <option value="found">Not reviewed</option>
        <option value="shortlisted">Shortlisted</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <span class="muted small">{{ rows.length }} creator{{ rows.length === 1 ? '' : 's' }}</span>
    </div>

    <div v-if="selected.size" class="row panel" style="padding: 8px 12px">
      <b>{{ selected.size }} selected</b>
      <button class="good" @click="bulk('approved')">Approve</button>
      <button @click="bulk('shortlisted')">Shortlist</button>
      <button class="bad" @click="bulk('rejected')">Reject</button>
      <button @click="selected = new Set()">Clear</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="rows.length" class="table-scroll">
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" :checked="allSelected" aria-label="Select all" @change="toggleAll"></th>
            <th>Creator</th><th>Country</th><th class="num">Subscribers</th><th class="num">Median views</th><th class="num">Videos / month</th>
            <th>Fit</th><th style="min-width: 240px">Reason and warnings</th><th>Also on</th><th>Review</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.creator_id" class="clickable" :class="{ selected: selected.has(r.creator_id) }" @click="openId = r.creator_id">
            <td @click.stop><input type="checkbox" :checked="selected.has(r.creator_id)" :aria-label="`Select ${r.name}`" @change="toggle(r.creator_id)"></td>
            <td>
              <b>{{ r.name }}</b>
              <div class="small"><a :href="r.youtube_url" target="_blank" rel="noopener noreferrer" @click.stop>{{ r.handle ? `@${r.handle}` : 'YouTube channel' }}</a></div>
              <div v-if="r.niches.length" class="small muted">{{ r.niches.join(', ') }}</div>
            </td>
            <td class="nowrap">
              {{ countryName(r.country) }}
              <div v-if="r.country_source === 'estimate'" class="small muted">estimate</div>
            </td>
            <td class="num" :title="`Checked ${date(r.checked_at)}. Source: ${r.source}`">{{ num(r.followers) }}</td>
            <td class="num">{{ num(r.median_recent_views) }}</td>
            <td class="num">{{ r.posts_per_month ?? 'n/a' }}</td>
            <td>
              <span v-if="r.fit_score" class="score" :class="`s${r.fit_score}`">{{ r.fit_score }}</span>
              <span v-else class="pill" :title="r.score_error || 'Not scored yet'">none</span>
              <div v-if="r.edited" class="small muted">edited</div>
            </td>
            <td>
              <div>{{ r.reason || (r.score_error ? 'Could not be scored. Open to score by hand.' : 'Not scored yet.') }}</div>
              <div v-if="r.excluded_reason" class="badline">Blocked: {{ r.excluded_reason }}</div>
              <div v-for="w in r.warnings" :key="w" class="warnline">⚠ {{ w }}</div>
              <div v-if="r.estimate_note" class="small muted">Estimate: {{ r.estimate_note }}</div>
            </td>
            <td class="small nowrap">
              <div v-for="l in r.linked" :key="l.platform + l.handle">
                <a :href="l.url" target="_blank" rel="noopener noreferrer" @click.stop>{{ l.platform }}</a>
                <span class="muted" style="margin-left: 5px">{{ l.check_status === 'checked' ? compact(l.followers) : 'not checked' }}</span>
              </div>
            </td>
            <td class="nowrap" @click.stop>
              <div class="row" style="gap: 4px; flex-wrap: nowrap">
              <button class="tiny good" :class="{ on: r.status === 'approved' }" :disabled="Boolean(r.excluded_reason)" :title="r.excluded_reason ? 'Open the creator to clear the flag first' : 'Approve'" @click="setStatus(r, 'approved')">Approve</button>
              <button class="tiny mid" :class="{ on: r.status === 'shortlisted' }" :disabled="Boolean(r.excluded_reason)" @click="setStatus(r, 'shortlisted')">Shortlist</button>
              <button class="tiny bad" :class="{ on: r.status === 'rejected' }" @click="setStatus(r, 'rejected')">Reject</button>
              </div>
              <div v-if="r.reviewed_by && r.status !== 'found'" class="small muted">by {{ r.reviewed_by }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="!loading" class="panel">
      <p v-if="brief.status === 'draft'">Nothing has been searched yet. Check the plan on the Searches tab, then press <b>Start the search</b>.</p>
      <p v-else>No creators match. If the search is still running, they appear here as each channel is checked.</p>
    </div>

    <CreatorDrawer v-if="openId" :brief="brief" :creator-id="openId" @close="closed" />
  </div>
</template>
