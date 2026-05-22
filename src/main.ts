import { createApp } from 'vue'
import './style.css'
import Root from './Root.vue'
import { router } from './router'
import posthog from 'posthog-js'

try {
  posthog.init('phc_zYbiSnzsMpq4qYZmCtnVFtgi4PhUeu2JhaFB4UCJRvpL', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-01-30',
  })
} catch {
  // PostHog unavailable — analytics disabled, app still works
}

const app = createApp(Root)
app.use(router)

app.config.errorHandler = (err) => {
  try { posthog.captureException(err) } catch { /* ignore */ }
}

app.mount('#app')
