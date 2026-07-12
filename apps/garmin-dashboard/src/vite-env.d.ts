/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OAUTH_PROXY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
