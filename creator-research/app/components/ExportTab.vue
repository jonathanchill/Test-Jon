<script setup lang="ts">
const props = defineProps<{ brief: any, approved: number, tick: number }>()
const emit = defineEmits<{ rescored: [] }>()
const status = inject<Ref<any>>('status')!
const confirmed = ref(false)
const notes = ref(props.brief.notes ?? '')
const message = ref('')
const demo = computed(() => status.value?.dataMode === 'demo')
const href = computed(() => `/api/briefs/${props.brief.id}/export?confirm=yes${demo.value ? '&demo=yes' : ''}`)

async function rescore() {
  if (!window.confirm('Score again with this guidance? Scores you have edited, and creators already approved or rejected, are kept.')) return
  const res = await $fetch<{ rescoring: number }>(`/api/briefs/${props.brief.id}/rescore`, { method: 'POST', body: { notes: notes.value } })
  message.value = `${res.rescoring} creator(s) are being scored again.`
  emit('rescored')
}
</script>

<template>
  <div>
    <div class="panel">
      <h2 style="margin-top: 0">Export the approved list</h2>
      <p>The sheet holds <b>{{ approved }} approved creator{{ approved === 1 ? '' : 's' }}</b>, with a count by country, niche and size. Creators who are not approved are never included.</p>
      <p v-if="demo" class="note warn">This is demo data. The file is marked DEMO and must not go to a client.</p>
      <label style="font-weight: 400" class="row">
        <input v-model="confirmed" type="checkbox" style="width: auto">
        I, {{ status?.you }}, have reviewed every creator on this list and approve it to go to the client.
      </label>
      <p>
        <a v-if="confirmed && approved > 0" class="btn primary" :href="href">Download the sheet (.xlsx)</a>
        <button v-else class="primary" disabled>Download the sheet (.xlsx)</button>
        <span class="small muted" style="margin-left: 10px">Opens in Excel or Google Sheets. Your name and the date are recorded.</span>
      </p>
    </div>
    <div class="panel">
      <h2 style="margin-top: 0">Tune the scoring</h2>
      <p class="muted">The scores are only as good as what Claude knows about this client. Two things teach it:</p>
      <ul class="plain muted">
        <li><b>Your decisions.</b> Approve, reject or correct 20 to 30 creators first, with a short note where the reason is not obvious. Claude is shown those decisions when it scores the rest.</li>
        <li><b>The guidance below.</b> Say in plain words what a good fit looks like and what rules a creator out.</li>
      </ul>
      <p class="muted">Then score again. Creators you have already approved, rejected or edited are left alone. Allow a day for this on the first real brief.</p>
      <label for="guide">What counts as a good fit</label>
      <textarea id="guide" v-model="notes" style="min-height: 110px" />
      <p><button :disabled="!status?.claude.ready" @click="rescore">Save and score again</button> <span v-if="message" class="small muted">{{ message }}</span></p>
    </div>
  </div>
</template>
