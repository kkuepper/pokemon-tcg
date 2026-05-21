import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import TrackerView from './views/TrackerView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/tracker', component: TrackerView },
    { path: '/:slug?', component: App },
  ],
})
