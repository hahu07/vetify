/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUSINESS_PARTY_ID?: string
  readonly VITE_VETIFY_PARTY_ID?: string
  readonly VITE_VERIFIER_PARTY_ID?: string
  readonly VITE_FI_PARTY_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
