/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Present only when a real Firebase project is wired up. */
  readonly VITE_FIREBASE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
