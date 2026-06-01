import posthog from 'posthog-js'

// Thin, privacy-aware analytics wrapper. It is a NO-OP unless `VITE_POSTHOG_KEY`
// is set (so dev/tests/builds without a key send nothing), and it respects the
// browser's Do-Not-Track. PostHog gives us visit counts + session duration out of
// the box; `track()` adds product events (which positions/transitions get explored)
// and `identify()` is ready for a future sign-up feature.

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'

let enabled = false

export function initAnalytics() {
  if (enabled || !KEY) return
  if (typeof window === 'undefined') return
  // PRODUCTION ONLY — never send from local dev (`vite dev` sets PROD=false) or tests.
  if (!import.meta.env.PROD) return
  if (navigator.doNotTrack === '1' || (window as unknown as { doNotTrack?: string }).doNotTrack === '1') return
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true, // visits + session duration
    autocapture: true,
    persistence: 'localStorage+cookie',
  })
  enabled = true
}

export function track(event: string, props?: Record<string, unknown>) {
  if (enabled) posthog.capture(event, props)
}

/** Tie events to a user once sign-up exists. No-op until analytics is enabled. */
export function identify(id: string, props?: Record<string, unknown>) {
  if (enabled) posthog.identify(id, props)
}
