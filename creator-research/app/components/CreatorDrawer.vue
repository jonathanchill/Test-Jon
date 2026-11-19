<script setup lang="ts">
const props = defineProps<{ brief: any, creatorId: number }>()
const emit = defineEmits<{ close: [changed: boolean] }>()

const c = ref<any>(null)
const error = ref('')
const changed = ref(false)
const edit = reactive({ fit_score: 3, reason: '', warnings: '', review_note: '', country: '' })
const base = `/api/briefs/${props.brief.id}/creators/${props.creatorId}`

function fill(d: any) {
  c.value = d
  Object.assign(edit, { fit_score: d.fit_score ?? 3, reason: d.reason ?? '', warnings: d.warnings.join('\n'), review_note: d.review_note ?? '', country: d.country ?? '' })
}
onMounted(async () => {
  try { fill(await $fetch<any>(base)) } catch (e) { error.value = errorText(e) }
})

async function patch(body: Record<string, unknown>) {
  error.value = ''
  try {
    fill(await $fetch<any>(base, { method: 'PATCH', body }))
    changed.value = true
  } catch (e) {
    error.value = errorText(e)
  }
}
function saveEdits() {
  const body: Record<string, unknown> = { review_note: edit.review_note }
  const warnings = edit.warnings.split('\n').map(w => w.trim()).filter(Boolean)
  if (edit.fit_score !== c.value.fit_score) body.fit_score = edit.fit_score
  if (edit.reason !== (c.value.reason ?? '')) body.reason = edit.reason
  if (warnings.join('\n') !== c.value.warnings.join('\n')) body.warnings = warnings
  const country = edit.country.trim().toUpperCase()
  if (country !== (c.value.country ?? '')) body.country = country || null
  return patch(body)
}
async function remove() {
  if (!window.confirm(`Delete ${c.value.name} from the tool completely? This removes them from every brief and they will not be found again. Use this when a creator asks to be removed.`)) return
  try {
    await $fetch(`/api/creators/${props.creatorId}`, { method: 'DELETE' })
    emit('close', true)
  } catch (e) {
    error.value = errorText(e)
  }
}
const yt = computed(() => c.value?.accounts.find((a: any) => a.platform === 'youtube'))
</script>

<template>
  <div class="drawer-back" @click="emit('close', changed)" />
  <aside class="drawer" role="dialog" aria-label="Creator details">
    <div class="row">
      <h2 style="flex: 1; margin: 0">{{ c?.name ?? 'Loading…' }}</h2>
      <button @click="emit('close', changed)">Close</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="c">
      <p v-if="c.excluded_reason" class="error">
        <b>Blocked from approval.</b> {{ c.excluded_reason }}
        <button class="tiny" style="margin-left: 8px" @click="patch({ clear_exclusion: true })">I have checked: clear the flag</button>
      </p>
      <div class="row" style="margin: 10px 0">
        <button class="good" :class="{ on: c.status === 'approved' }" :disabled="Boolean(c.excluded_reason)" @click="patch({ status: 'approved' })">Approve</button>
        <button class="mid" :class="{ on: c.status === 'shortlisted' }" :disabled="Boolean(c.excluded_reason)" @click="patch({ status: 'shortlisted' })">Shortlist</button>
        <button class="bad" :class="{ on: c.status === 'rejected' }" @click="patch({ status: 'rejected' })">Reject</button>
        <span v-if="c.reviewed_by" class="small muted">last reviewed by {{ c.reviewed_by }}, {{ date(c.reviewed_at) }}</span>
      </div>

      <h3>Accounts</h3>
      <div v-for="a in c.accounts" :key="a.id" class="panel" style="margin: 8px 0; padding: 10px 12px">
        <div class="row"><b style="text-transform: capitalize">{{ a.platform }}</b> <a :href="a.url" target="_blank" rel="noopener noreferrer">{{ a.handle ? `@${a.handle}` : a.url }}</a></div>
        <dl v-if="a.check_status === 'checked'">
          <dt>Followers</dt><dd>{{ num(a.followers) }}</dd>
          <dt>Median recent views</dt><dd>{{ num(a.median_recent_views) }} <span class="muted small">across {{ a.videos_sampled ?? 0 }} recent posts</span></dd>
          <dt>Posts per month</dt><dd>{{ a.posts_per_month ?? 'n/a' }}</dd>
          <dt>Last post</dt><dd>{{ date(a.last_post_at) }}</dd>
        </dl>
        <p v-else-if="a.check_status === 'unchecked'" class="muted small">Numbers not checked. {{ a.platform === 'tiktok' ? 'TikTok has no route switched on yet, so check this one by hand.' : a.platform === 'instagram' ? 'Instagram lookups start when the Meta app is set up.' : '' }}</p>
        <p v-else class="muted small">No public numbers.</p>
        <p class="small muted">Source: {{ a.source }}<span v-if="a.checked_at"> · checked {{ date(a.checked_at) }}</span><span v-if="a.link_source"> · found via: {{ a.link_source }}</span></p>
      </div>

      <h3>Why they are on the list</h3>
      <ul class="plain">
        <li v-for="(e, i) in c.evidence" :key="i">
          <a :href="e.url" target="_blank" rel="noopener noreferrer">{{ e.title }}</a>
          <div class="small muted">found by the {{ e.kind }} search “{{ e.term }}” ({{ e.region }}, {{ e.language }}) on {{ date(e.found_at) }}</div>
        </li>
      </ul>

      <h3>Recent videos</h3>
      <ul class="plain small">
        <li v-for="v in (yt?.recent_items ?? []).slice(0, 12)" :key="v.id">
          <a :href="v.url" target="_blank" rel="noopener noreferrer">{{ v.title }}</a>
          <span class="muted" style="margin-left: 5px">· {{ num(v.views) }} views · {{ date(v.published_at) }}</span>
        </li>
      </ul>

      <h3>Score and reason <span class="hint">{{ c.edited ? 'edited by a person' : c.score_source ? `written by ${c.score_source}` : 'not scored' }}</span></h3>
      <p v-if="c.score_error" class="small muted">Scoring error: {{ c.score_error }}</p>
      <form @submit.prevent="saveEdits">
        <div class="row" style="align-items: flex-start">
          <div style="width: 90px"><label for="fit">Fit</label><select id="fit" v-model.number="edit.fit_score"><option v-for="s in [5, 4, 3, 2, 1]" :key="s" :value="s">{{ s }}</option></select></div>
          <div style="width: 110px"><label for="ctry">Country</label><input id="ctry" v-model="edit.country" type="text" maxlength="2" placeholder="GB"></div>
          <div style="flex: 1; min-width: 220px"><label for="reason">Reason</label><input id="reason" v-model="edit.reason" type="text"></div>
        </div>
        <p v-if="c.country_source === 'estimate'" class="small muted">The country is an estimate from language and content. Correct it here if you know better.</p>
        <label for="warn" style="margin-top: 8px">Warnings <span class="hint">one per line</span></label>
        <textarea id="warn" v-model="edit.warnings" />
        <p v-if="c.estimate_note" class="small muted">Estimate: {{ c.estimate_note }}</p>
        <label for="note" style="margin-top: 8px">Your note <span class="hint">internal, not exported</span></label>
        <textarea id="note" v-model="edit.review_note" />
        <p><button class="primary" type="submit">Save changes</button></p>
      </form>

      <h3>Delete on request</h3>
      <p class="small muted">If this creator asks to be removed, delete them. Their record is removed from every brief and later searches will skip them.</p>
      <button class="bad" @click="remove">Delete this creator</button>
    </template>
  </aside>
</template>
