<script setup lang="ts">
const status = inject<Ref<any>>('status')!
const form = reactive({
  client: '', name: '', niches: '', products: '', countries: 'GB, FR', languages: 'en, fr',
  follower_min: 10000, follower_max: '' as number | '', exclusions: '', notes: '',
})
const saving = ref(false)
const error = ref('')
const split = (s: string) => s.split(/[\n,]+/).map(x => x.trim()).filter(Boolean)

function example() {
  Object.assign(form, {
    client: 'My Arcade', name: 'UK and France, established creators',
    niches: 'retro gaming\nnostalgia\ntoys and gifting\ngadgets\nvan life',
    products: 'My Arcade\nEvercade\nArcade1Up\nretro handheld\n80s toys',
    countries: 'GB, FR', languages: 'en, fr', follower_min: 10000, follower_max: '',
    notes: 'Good fit: individual creators who review or collect retro games, toys or gadgets for an adult audience. Not a fit: shops, brands, news channels, channels aimed at young children.',
  })
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    const res = await $fetch<{ id: number }>('/api/briefs', {
      method: 'POST',
      body: {
        client: form.client, name: form.name, niches: split(form.niches), products: split(form.products),
        countries: split(form.countries), languages: split(form.languages),
        follower_min: Number(form.follower_min) || 0, follower_max: form.follower_max === '' ? null : Number(form.follower_max),
        exclusions: split(form.exclusions), notes: form.notes,
      },
    })
    await navigateTo(`/briefs/${res.id}?tab=searches`)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div style="max-width: 900px">
    <div class="row" style="margin-top: 20px">
      <h1 style="flex: 1">New brief</h1>
      <button type="button" @click="example">Fill in the My Arcade example</button>
    </div>
    <p class="muted">Saving writes the search plan. Nothing is searched until you press Start on the next screen, so you can read and edit the plan first.</p>
    <form class="panel" @submit.prevent="save">
      <div class="grid2">
        <div><label for="client">Client</label><input id="client" v-model="form.client" type="text" required></div>
        <div><label for="name">Brief name</label><input id="name" v-model="form.name" type="text" required placeholder="UK and France, established creators"></div>
        <div>
          <label for="niches">Niches <span class="hint">one per line</span></label>
          <textarea id="niches" v-model="form.niches" required placeholder="retro gaming&#10;nostalgia&#10;toys and gifting" />
        </div>
        <div>
          <label for="products">Products <span class="hint">the client's and similar ones, one per line. These are searched first.</span></label>
          <textarea id="products" v-model="form.products" placeholder="Evercade&#10;Arcade1Up&#10;retro handheld" />
        </div>
        <div><label for="countries">Countries <span class="hint">two-letter codes</span></label><input id="countries" v-model="form.countries" type="text" required></div>
        <div><label for="languages">Languages <span class="hint">two-letter codes</span></label><input id="languages" v-model="form.languages" type="text" required></div>
        <div>
          <label for="min">Smallest follower count to check</label>
          <input id="min" v-model="form.follower_min" type="number" min="0" step="1000">
          <div class="hint">Channels below this are counted but not scored. Set it to the smallest size you might want, then slice the list by size afterwards.</div>
        </div>
        <div><label for="max">Largest follower count <span class="hint">leave empty for no upper limit</span></label><input id="max" v-model="form.follower_max" type="number" min="1" step="1000"></div>
        <div>
          <label for="excl">Creators to leave out <span class="hint">names, @handles or channel links, one per line</span></label>
          <textarea id="excl" v-model="form.exclusions" />
        </div>
        <div>
          <label for="notes">What counts as a good fit <span class="hint">Claude reads this when scoring</span></label>
          <textarea id="notes" v-model="form.notes" />
        </div>
      </div>
      <p v-if="status && !status.claude.ready" class="note warn">Claude is not set up, so only the brief's own words will be searched. You can add search terms in other languages by hand on the next screen.</p>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="row">
        <button class="primary" type="submit" :disabled="saving">{{ saving ? 'Writing the search plan…' : 'Save and write the search plan' }}</button>
      </p>
    </form>
  </div>
</template>
