<script setup lang="ts">
const props = defineProps<{ brief: any, counts: any, tick: number }>()
const hidden = ref<any[]>([])
async function load() { hidden.value = await $fetch<any[]>(`/api/briefs/${props.brief.id}/creators`, { query: { stage: 'not_checkable' } }) }
watch(() => props.tick, load)
onMounted(load)
</script>

<template>
  <div v-if="counts">
    <p class="muted" style="margin-top: 14px">What this list could not check, so nobody reads more into it than is there.</p>
    <div class="panel">
      <ul class="plain">
        <li><b>{{ counts.notChecked.noPublicNumbers }}</b> channel(s) hide their subscriber count or could not be read, so they are not scored. They are listed below.</li>
        <li><b>{{ counts.funnel.outOfRange }}</b> channel(s) are outside the brief's follower range. They are counted but not scored.</li>
        <li><b>{{ counts.funnel.leftOut }}</b> channel(s) are on the brief's leave-out list.</li>
        <li><b>{{ counts.notChecked.notScored }}</b> creator(s) in range have no fit score<span v-if="counts.notChecked.scoreErrors"> ({{ counts.notChecked.scoreErrors }} after an error)</span>. Score these by hand from the review list.</li>
        <li><b>{{ counts.notChecked.linkedAccountsUnchecked }}</b> linked Instagram, TikTok or Twitch account(s) were found but their numbers were not checked.</li>
        <li><b>{{ counts.notChecked.countryEstimated }}</b> creator(s) do not declare a country, so theirs is an estimate. <b>{{ counts.notChecked.countryUnknown }}</b> have no country at all.</li>
        <li v-if="counts.notChecked.failedSearches"><b>{{ counts.notChecked.failedSearches }}</b> search(es) failed. See the Searches tab.</li>
        <li v-if="counts.funnel.waitingForNumbers"><b>{{ counts.funnel.waitingForNumbers }}</b> channel(s) are still waiting for their numbers to be pulled.</li>
      </ul>
    </div>
    <div class="panel">
      <h3 style="margin-top: 0">What no version of this tool can tell you</h3>
      <ul class="plain">
        <li>Where a creator's followers live or how old they are. That is not in any public data.</li>
        <li>Whether followers are real. Views far below the follower count are flagged, which catches most but not all.</li>
        <li>Creators who are only on TikTok or Instagram. They are found only when a YouTube creator links to them.</li>
      </ul>
    </div>
    <h2>Channels with no public numbers</h2>
    <div v-if="hidden.length" class="table-scroll">
      <table>
        <thead><tr><th>Channel</th><th>Why</th></tr></thead>
        <tbody>
          <tr v-for="r in hidden" :key="r.creator_id">
            <td><a :href="r.primary_url" target="_blank" rel="noopener noreferrer">{{ r.name }}</a></td>
            <td>{{ r.check_status === 'not_found' ? 'YouTube returned nothing for this channel' : 'Subscriber count is hidden' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="muted">None.</p>
  </div>
</template>
