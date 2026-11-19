export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  ssr: false, // an internal tool behind a login: a client-rendered app talking to the API
  devtools: { enabled: false },
  css: ['~/assets/main.css'],
  app: {
    head: {
      title: 'Creator research',
      meta: [{ name: 'robots', content: 'noindex, nofollow' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  typescript: { strict: true },
})
