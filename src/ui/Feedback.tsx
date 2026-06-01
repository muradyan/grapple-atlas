// Feedback / contact line. The contact lives in one place so it's easy to change.
const CONTACT_URL = 'https://instagram.com/amur.raf'

export default function Feedback({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-[11px] text-slate-500 ${className}`}>
      <span>We’d love your ideas to improve Grapple Explorer</span>
      <a
        href={CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Message us on Instagram"
        title="Message us on Instagram"
        className="text-slate-400 transition hover:text-accent"
      >
        <InstagramIcon />
      </a>
    </div>
  )
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
