import { StrictMode, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from '../i18n/LanguageContext'
import { VenueViewer } from './VenueViewer'
import { TablePicker } from './TablePicker'
import type { Tier, VenueTable } from './types'
import '../styles.css'

/**
 * The venue viewer on a page of its own (venue.html), so the ticket journey, a
 * separate app, can open the same 3D inside its checkout without a copy of three.js
 * or the model of its own.
 *
 * Query string:
 *   table=A07     open on this table
 *   tier=…        starr-castle | cold-rush: the package being looked at or chosen for
 *   pick=1        run as a picker: "Choose table A07" sends the table to the opener
 *   n=1&of=2      which of the buyer's tables of this package is being placed
 *   taken=A01,B12 tables that can be viewed but not chosen (already in the basket)
 *   lang=en|sw    the opener's language
 *   origin=…      the embedding page's origin; messages go to that origin only
 *
 * Any of table / tier / pick opens the TABLE scene (TablePicker): aerial opening,
 * package lit, hologram tag on the table in focus. With none of them it is the
 * walkthrough (VenueViewer), as the microsite's "The experience" shows it.
 *
 * Messages to the parent, { source: 'cl-venue', action: 'choose' | 'close', table? }.
 * A chosen table carries only its public facts (id, platform, row, tier, price).
 *
 * Opened directly rather than embedded, closing goes back to the microsite.
 */

const q = new URLSearchParams(window.location.search)
// The opener's language wins over whatever this origin last stored, before first render.
const lang = q.get('lang')
if (lang === 'en' || lang === 'sw') {
  try {
    localStorage.setItem('cl_lang', lang)
  } catch {
    /* storage blocked: the default language stands */
  }
}
const pick = q.get('pick') === '1'
const tierQ = q.get('tier')
const tier: Tier | undefined = tierQ === 'starr-castle' || tierQ === 'cold-rush' ? tierQ : undefined
const num = (k: string) => {
  const v = Number(q.get(k))
  return Number.isInteger(v) && v > 0 && v <= 20 ? v : undefined
}
const tableMode = pick || !!tier || q.has('table')
const table = q.get('table') ?? undefined
const taken = (q.get('taken') ?? '').split(',').filter(Boolean)
const embedded = window.parent !== window
const target = (() => {
  try {
    return new URL(q.get('origin') ?? window.location.origin).origin
  } catch {
    return window.location.origin
  }
})()

type Msg = { action: 'choose'; table: Pick<VenueTable, 'id' | 'platform' | 'row' | 'seat' | 'tier' | 'price'> } | { action: 'close' }

function post(msg: Msg) {
  window.parent.postMessage({ source: 'cl-venue', ...msg }, target)
}

function Standalone() {
  const close = useCallback(() => {
    if (embedded) post({ action: 'close' })
    else window.location.href = import.meta.env.BASE_URL
  }, [])

  const choose = useCallback((t: VenueTable) => {
    const { id, platform, row, seat, tier, price } = t
    post({ action: 'choose', table: { id, platform, row, seat, tier, price } })
  }, [])

  if (tableMode) {
    return (
      <TablePicker
        tier={tier}
        tableId={table}
        pick={pick && embedded}
        n={num('n')}
        of={num('of')}
        taken={taken}
        onChoose={pick && embedded ? choose : undefined}
        onClose={close}
        embedded={embedded}
      />
    )
  }

  return (
    <VenueViewer
      open
      onClose={close}
      initialTableId={table}
      onChooseTable={pick && embedded ? choose : undefined}
      chooseLabel={pick && embedded ? 'Choose this table' : undefined}
      unavailable={taken}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <Standalone />
    </LanguageProvider>
  </StrictMode>,
)
