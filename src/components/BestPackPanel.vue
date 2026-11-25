<script setup lang="ts">
import { formatPct } from '../utils/odds'

withDefaults(defineProps<{
  entries: { label: string; prob: number }[]
  title?: string
  subtitle?: string
  /** Hover text. The event card uses this to spell out the equal-odds assumption. */
  subtitleDetail?: string
}>(), {
  title: 'Best Pack to Open',
  subtitle: "Highest chance of drawing a card you don't have yet",
  subtitleDetail: '',
})
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
    <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide leading-snug mb-3">{{ title }}</h2>
    <p
      class="text-xs text-gray-400 leading-snug mb-3"
      :class="subtitleDetail ? 'cursor-help' : ''"
      :title="subtitleDetail || undefined"
    >{{ subtitle }}</p>
    <ol class="space-y-2">
      <li
        v-for="(entry, i) in entries"
        :key="entry.label"
        class="flex items-center gap-2 text-sm"
      >
        <span class="text-xs text-gray-400 w-4 shrink-0 text-right">{{ i + 1 }}.</span>
        <span class="flex-1 truncate text-gray-700">{{ entry.label }}</span>
        <span class="shrink-0 font-medium" :class="i === 0 ? 'text-blue-600' : 'text-gray-500'">
          {{ formatPct(entry.prob) }}
        </span>
      </li>
    </ol>
  </div>
</template>
