import { useEffect, useState } from 'react'
import { VenueViewer } from './VenueViewer'
import { warmVenue } from './preload'
import type { VenueTable } from './types'

/**
 * The reusable way into the 3D.
 *
 * One component serves every entry point the journey needs — the home-screen button,
 * the end of a General or VIP purchase, and the mid-checkout preview a VVIP buyer
 * gets before committing 5,000,000 TZS — because they differ only in their label and
 * in whether a table can be chosen, never in behaviour.
 *
 * Mounting it starts the background warm-up, so by the time anyone presses the button
 * the model is usually already in the HTTP cache and the viewer opens on a local read.
 */

export interface VenueEntryProps {
  label?: string
  className?: string
  /** Open already looking at this table (the one being bought). */
  initialTableId?: string
  /** Supply to run as a picker inside checkout; omit for look-around-only. */
  onChooseTable?: (t: VenueTable) => void
  chooseLabel?: string
  /** Told when the overlay opens and closes, e.g. to pause a video underneath. */
  onToggle?: (open: boolean) => void
}

export function VenueEntry({
  label = 'See the setup in 3D',
  className = 'venue-cta',
  initialTableId,
  onChooseTable,
  chooseLabel,
  onToggle,
}: VenueEntryProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    warmVenue()
  }, [])

  useEffect(() => {
    onToggle?.(open)
  }, [open, onToggle])

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        // A hover or a touch-down is a strong signal; make sure the fetch has begun.
        onPointerEnter={warmVenue}
      >
        {label}
      </button>
      <VenueViewer
        open={open}
        onClose={() => setOpen(false)}
        initialTableId={initialTableId}
        onChooseTable={
          onChooseTable &&
          ((t) => {
            onChooseTable(t)
            setOpen(false)
          })
        }
        chooseLabel={chooseLabel}
      />
    </>
  )
}
