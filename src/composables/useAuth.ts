import { ref, type Ref } from 'vue'
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

interface AuthState {
  user: Ref<User | null>
  authLoading: Ref<boolean>
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

let instance: AuthState | null = null

export function useAuth(): AuthState {
  if (instance) return instance

  const user = ref<User | null>(null)
  const authLoading = ref(true)

  onAuthStateChanged(auth, (u) => {
    user.value = u
    authLoading.value = false
  })

  async function signIn() {
    try { await signInWithPopup(auth, googleProvider) } catch (e) { console.error('Sign-in failed', e) }
  }

  async function signOut() {
    try { await firebaseSignOut(auth) } catch (e) { console.error('Sign-out failed', e) }
  }

  return (instance = { user, authLoading, signIn, signOut })
}
