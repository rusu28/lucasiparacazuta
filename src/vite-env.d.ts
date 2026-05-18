/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
  readonly VITE_PURCAR_AGENT_API_URL?: string;
  readonly VITE_PURCAR_CHAT_API_URL?: string;
  readonly VITE_PURCAR_HF_MODEL_ID?: string;
  readonly VITE_DEMO_ELITE_EMAIL?: string;
  readonly VITE_DEMO_ELITE_PASSWORD?: string;
  readonly VITE_DEMO_ELITE_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
