<script setup lang="ts">
const status = inject<Ref<any>>('status')!
const { data: briefs } = await useFetch<any[]>('/api/briefs')
</script>

<template>
  <div>
    <div class="row" style="margin-top: 20px">
      <h1 style="flex: 1">Briefs</h1>
      <NuxtLink to="/briefs/new" class="btn primary">New brief</NuxtLink>
    </div>
    <p class="muted">A brief says what to look for. The tool searches YouTube, pulls each channel's numbers, scores the fit, and gives you a list to review.</p>

    <div v-if="status && status.dataMode !== 'demo' && (!status.youtube.ready || !status.claude.ready)" class="note warn">
      <b>Not fully set up.</b>
      <span v-if="!status.youtube.ready"> The YouTube key is missing, so searches cannot run.</span>
      <span v-if="!status.claude.ready"> The Claude key is missing, so creators will be listed without a fit score.</span>
      See <NuxtLink to="/setup">Set-up and rules</NuxtLink>.
    </div>

    <div v-if="briefs?.length" class="table-scroll">
      <table>
        <thead>
          <tr><th>Brief</th><th>Countries</th><th>Status</th><th class="num">Searches</th><th class="num">In range</th><th class="num">Approved</th><th>Created</th></tr>
        </thead>
        <tbody>
          <tr v-for="b in briefs" :key="b.id">
            <td><NuxtLink :to="`/briefs/${b.id}`"><b>{{ b.client }}</b>: {{ b.name }}</NuxtLink><div class="small muted">{{ b.niches.join(', ') }}</div></td>
            <td>{{ b.countries.map(countryName).join(', ') }}</td>
            <td><span class="pill" :class="{ good: b.status === 'complete', info: b.status === 'running', warn: b.status === 'waiting_quota' }">{{ STATUS_LABEL[b.status] }}</span></td>
            <td class="num">{{ b.searches_done }} / {{ b.searches_total }}</td>
            <td class="num">{{ num(b.in_range) }}</td>
            <td class="num">{{ num(b.approved) }}</td>
            <td class="nowrap">{{ date(b.created_at) }}<div class="small muted">{{ b.created_by }}</div></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="panel">
      <p>No briefs yet. <NuxtLink to="/briefs/new">Write the first one.</NuxtLink></p>
    </div>
  </div>
</template>
