import { createApp } from 'vue'
import './style.css'
import Root from './Root.vue'
import { router } from './router'
import posthog from 'posthog-js'
import { hasAnalyticsConsent, loadAnalytics } from './analytics'

if (hasAnalyticsConsent()) loadAnalytics()

try {
  posthog.init('phc_zYbiSnzsMpq4qYZmCtnVFtgi4PhUeu2JhaFB4UCJRvpL', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-01-30',
    // autocapture and heatmaps each install a global click listener that reads element geometry
    // (getBoundingClientRect), forcing a ~300ms full-page reflow on the large tracker grid. We rely
    // only on explicit posthog.capture(...) calls, so both are safe to disable.
    autocapture: false,
    capture_heatmaps: false,
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
