// ─── Coop config ────────────────────────────────────────────────────────────
// Leave everything blank and Coop runs in LOCAL mode: two browser tabs on THIS
// computer can play each other (great for testing). Fill in ONE of the two
// backends below to play with friends over the internet.

// ── Option A: Ably ──────────────────────────────────────────────────────────
// 1. ably.com  ->  sign up (free, no credit card)
// 2. Your app  ->  API Keys tab
//
// ⚠️  DO NOT paste the "Root" key here. This file ships to the browser, so
//     anyone can read it, and the root key controls your whole account.
//     Instead: API Keys -> Create a new API key, and give it ONLY
//       capabilities : subscribe, publish, presence
//       resources    : coop:*
//     That key can do nothing except play Coop, so it's fine in public code.

export const ABLY_KEY = 'AK3OMQ.OWsZ4g:OGQcbrXp0TH2VxxPO1KsCJAIDsAwp5mu9h_30nll5jM';

// ── Option B: Supabase ──────────────────────────────────────────────────────
// 1. supabase.com  ->  Start your project  ->  sign in with GitHub
// 2. New project. Any name. Region near you. Wait ~1 min.
// 3. Project Settings (gear)  ->  API
// 4. Copy "Project URL" and the "anon public" key below.
// The anon key is designed to be public, so it's safe to commit as-is.

export const SUPABASE_URL      = '';
export const SUPABASE_ANON_KEY = '';

export const SITE_NAME = 'Coop';
