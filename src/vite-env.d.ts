/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Canonical app URL for auth email links (no trailing slash). */
  readonly VITE_SITE_URL?: string;
}

/** Injected in vite.config.ts from CI (Vercel / Cloudflare / GitHub Actions). */
declare const __MOTUS_DEPLOY_ID__: string;
