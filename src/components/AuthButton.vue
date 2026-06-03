<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'

const { user, authLoading, signIn, signOut } = useAuth()
const imgError = ref(false)

watch(user, () => { imgError.value = false })
</script>

<template>
  <div v-if="!authLoading">
    <!-- Signed in: avatar circle, click to sign out -->
    <button
      v-if="user"
      @click="signOut"
      class="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
      :title="`Signed in as ${user.displayName ?? user.email} — click to sign out`"
    >
      <img
        v-if="user.photoURL && !imgError"
        :src="user.photoURL"
        :alt="user.displayName ?? 'User avatar'"
        class="w-full h-full object-cover"
        @error="imgError = true"
      />
      <span v-else class="w-full h-full flex items-center justify-center bg-blue-600 text-white text-xs font-bold">
        {{ (user.displayName ?? user.email ?? '?')[0].toUpperCase() }}
      </span>
    </button>

    <!-- Signed out: Google sign-in button -->
    <button
      v-else
      @click="signIn"
      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors text-gray-700"
    >
      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Sign in
    </button>
  </div>
</template>
