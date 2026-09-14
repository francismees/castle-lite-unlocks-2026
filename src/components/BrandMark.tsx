/**
 * Official Castle Lite brand marks, served from /public/brand.
 *
 * Sources (see "00 - Assets/SVG"):
 *   castle-lite-lockup.svg  — full-colour Castle Lite banner, transparent ground,
 *                             drawn for dark/blue backgrounds.
 *   castle-lite-lockup-tight.svg — the same mark cropped to its artwork (no artboard
 *                             padding), for the brand bar where height is at a premium.
 *   unlocks-white.svg       — the Castle Lite Unlocks campaign lockup, white.
 *
 * Both are decorative here: the page's own bilingual H1 and the footer's legal lines
 * carry the meaning, so the marks take alt="" rather than duplicating that text for
 * screen-reader users. The one exception is the age gate, where the lockup is the
 * only branding on screen and is labelled.
 */

/** Castle Lite banner lockup — used in the sticky header and the footer. */
export function CastleLiteLogo({ variant = 'header' }: { variant?: 'header' | 'footer' }) {
  return (
    <img
      src="/brand/castle-lite-lockup-tight.svg"
      alt=""
      className={`logo-lockup logo-lockup--${variant}`}
      width={variant === 'footer' ? 75 : 87}
      height={variant === 'footer' ? 48 : 56}
      decoding="async"
    />
  )
}

/** Campaign lockup — "CASTLE LITE UNLOCKS". White, for blue grounds. */
export function UnlocksLockup({
  className = 'unlocks-lockup',
  label,
}: {
  className?: string
  /** Supply only where the lockup is the sole branding on screen (the age gate). */
  label?: string
}) {
  return (
    <img
      src="/brand/unlocks-white.svg"
      alt={label ?? ''}
      className={className}
      width={460}
      height={146}
      decoding="async"
    />
  )
}
