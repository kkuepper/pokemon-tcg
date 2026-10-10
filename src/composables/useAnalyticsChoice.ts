import { ref } from 'vue'
import {
  acceptAnalytics,
  declineAnalytics,
  hasAnalyticsConsent,
  hasDeclinedAnalytics,
  withdrawAnalytics,
} from '../analytics'

export type AnalyticsChoice = 'granted' | 'declined' | 'unknown'

function readChoice(): AnalyticsChoice {
  if (hasAnalyticsConsent()) return 'granted'
  if (hasDeclinedAnalytics()) return 'declined'
  return 'unknown'
}

const choice = ref<AnalyticsChoice>(readChoice())

/** Shared banner and footer state for the analytics choice. */
export function useAnalyticsChoice() {
  function accept() {
    acceptAnalytics()
    choice.value = 'granted'
  }

  function decline() {
    declineAnalytics()
    choice.value = 'declined'
  }

  function withdraw() {
    withdrawAnalytics()
    choice.value = 'declined'
  }

  return { choice, accept, decline, withdraw }
}
