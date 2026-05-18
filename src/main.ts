import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import posthog from 'posthog-js'

posthog.init('phc_zYbiSnzsMpq4qYZmCtnVFtgi4PhUeu2JhaFB4UCJRvpL', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-01-30',
})

const app = createApp(App)

app.config.errorHandler = (err) => {
  posthog.captureException(err)
}

app.mount('#app')
