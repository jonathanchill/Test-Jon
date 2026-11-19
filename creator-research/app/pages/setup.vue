<script setup lang="ts">
const status = inject<Ref<any>>('status')!
</script>

<template>
  <div style="max-width: 900px">
    <h1 style="margin-top: 20px">Set-up and rules</h1>
    <h2>What is connected</h2>
    <div v-if="status" class="table-scroll">
      <table>
        <thead><tr><th>Platform</th><th>Status</th><th>Route</th><th>Setting</th></tr></thead>
        <tbody>
          <tr><td>YouTube</td><td><span class="pill" :class="status.youtube.ready ? 'good' : 'bad'">{{ status.youtube.ready ? (status.dataMode === 'demo' ? 'Demo data' : 'Ready') : 'Key missing' }}</span></td><td>Official Data API, free</td><td><code>YOUTUBE_API_KEY</code></td></tr>
          <tr><td>Claude scoring</td><td><span class="pill" :class="status.claude.ready ? 'good' : 'bad'">{{ status.claude.ready ? (status.dataMode === 'demo' ? 'Demo scorer' : 'Ready') : 'Key missing' }}</span></td><td>Anthropic API</td><td><code>ANTHROPIC_API_KEY</code></td></tr>
          <tr><td>Instagram</td><td><span class="pill" :class="status.instagram.ready ? 'good' : 'warn'">{{ status.instagram.ready ? 'Ready' : 'Waiting on the Meta app' }}</span></td><td>Official Business Discovery API. Lookup by username only.</td><td><code>INSTAGRAM_ACCESS_TOKEN</code>, <code>INSTAGRAM_USER_ID</code></td></tr>
          <tr><td>TikTok</td><td><span class="pill warn">Decision needed</span></td><td>No official route for a commercial tool. Linked handles are recorded and checked by hand until an option is chosen.</td><td>none</td></tr>
        </tbody>
      </table>
    </div>
    <p class="muted small">Keys are read from environment settings on the server. They are never typed into this screen, a chat or a document.</p>

    <h2>Rules the tool enforces</h2>
    <ol>
      <li><b>It never contacts a creator.</b> There is no way to send a message from this tool.</li>
      <li><b>Official sources, and a source on every number.</b> Each account shows where its numbers came from and the date they were checked.</li>
      <li><b>It stays inside each platform's daily limits.</b> When a limit is reached the run stops and carries on after the reset.</li>
      <li><b>Public information only, and deletion on request.</b> Open a creator and use "Delete this creator". They are removed everywhere and not found again.</li>
      <li><b>No audience claims.</b> It never states where a creator's audience lives or how old they are. Any view is marked as an estimate.</li>
      <li><b>No gambling or casino content.</b> Flagged creators cannot be approved until a person has looked and cleared the flag.</li>
      <li><b>Nothing goes to a client until a person approves it.</b> The export holds approved creators only and records who signed it off.</li>
    </ol>
  </div>
</template>
