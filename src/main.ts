import { createApp } from 'vue'
import './style.css'
import Root from './Root.vue'
import { router } from './router'
import posthog from 'posthog-js'

posthog.init('phc_zYbiSnzsMpq4qYZmCtnVFtgi4PhUeu2JhaFB4UCJRvpL', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-01-30',
})

const app = createApp(Root)
app.use(router)

app.config.errorHandler = (err) => {
  posthog.captureException(err)
}

app.mount('#app')
