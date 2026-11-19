<script setup lang="ts">
const props = defineProps<{ brief: any, tick: number }>()
const minScore = ref(3)
const c = ref<any>(null)
async function load() {
  c.value = await $fetch<any>(`/api/briefs/${props.brief.id}/counts`, { query: { minScore: minScore.value } })
}
watch([minScore, () => props.tick], load)
onMounted(load)
</script>

<template>
  <div v-if="c">
    <div class="row" style="margin: 14px 0">
      <label for="min" style="margin: 0">Count a creator as fitting at score</label>
      <select id="min" v-model.number="minScore" style="width: auto"><option v-for="s in [5, 4, 3, 2, 1]" :key="s" :value="s">{{ s }}{{ s < 5 ? ' or higher' : '' }}</option></select>
    </div>
    <div class="panel">
      <h2 style="margin-top: 0">{{ num(c.fit) }} creators fit this brief</h2>
      <p class="muted small">
        Counted from YouTube's own data: {{ c.searches.done }} of {{ c.searches.total }} searches run, {{ num(c.funnel.channelsFound) }} channels found,
        {{ num(c.funnel.inRange) }} in the follower range, {{ num(c.funnel.scored) }} scored. Rejected and blocked creators are left out.
        <span v-if="c.searches.queued"> <b>{{ c.searches.queued }} searches have not run yet, so this number will rise.</b></span>
      </p>
      <p class="muted small">This counts creators found through YouTube searches, plus any added by hand. Creators who are only on TikTok or Instagram are in it only if someone added them. Follower counts are for each creator's main platform.</p>
    </div>

    <div v-for="t in [c.byCountry, c.byNiche]" :key="t.label">
      <h2>By {{ t.label.toLowerCase() }} and follower count</h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>{{ t.label }}</th><th v-for="b in c.bands" :key="b.key" class="num">{{ b.label }}</th><th class="num">Total</th></tr></thead>
          <tbody>
            <tr v-for="r in t.rows" :key="r.key">
              <td>{{ t.label === 'Country' ? r.key.replace(/^[A-Z]{2}/, (m: string) => countryName(m)) : r.key }}</td>
              <td v-for="b in c.bands" :key="b.key" class="num">{{ r.byBand[b.key] ?? 0 }}</td>
              <td class="num"><b>{{ r.total }}</b></td>
            </tr>
            <tr v-if="!t.rows.length"><td :colspan="c.bands.length + 2" class="muted">Nothing counted yet.</td></tr>
          </tbody>
        </table>
      </div>
      <p v-if="t.label === 'Niche'" class="small muted">A creator who covers two niches is counted under both, so these rows can add up to more than the total.</p>
      <p v-else class="small muted">Country is where the creator says they are based, or an estimate where marked. It says nothing about where their audience lives.</p>
    </div>

    <h2>By fit score</h2>
    <div class="row">
      <div v-for="s in c.byScore" :key="s.score" class="stat" style="min-width: 110px"><b>{{ s.count }}</b><span>score {{ s.score }}</span></div>
    </div>
  </div>
</template>
