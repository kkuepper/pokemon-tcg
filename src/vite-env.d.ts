/// <reference types="vite/client" />

declare const __BUILD_TIME__: number

interface ImportMetaEnv {
  readonly VITE_POSTHOG_PROJECT_TOKEN: string
  readonly VITE_POSTHOG_HOST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
