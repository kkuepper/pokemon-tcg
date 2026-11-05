import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import TrackerView from './views/TrackerView.vue'
import PrivacyView from './views/PrivacyView.vue'
import MetaDecksView from './views/MetaDecksView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/privacy', component: PrivacyView },
    { path: '/tracker', component: TrackerView },
    { path: '/meta-decks', component: MetaDecksView },
    { path: '/:slug?', component: App },
  ],
})
