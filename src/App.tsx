import { useEffect, useState } from 'react'
import { LanguageProvider, useLang } from './i18n/LanguageContext'
import { syncServerTime } from './lib/serverTime'
import { AgeGate, readGateState, type GateState } from './components/AgeGate'
import { Hero, SiteHeader } from './components/Hero'
import { CodeEntry } from './components/CodeEntry'
import { Tickets } from './components/Tickets'
import { EventsMap } from './components/EventsMap'
import { HowItWorks } from './components/HowItWorks'
import { Activations } from './components/Activations'
import { Terms } from './components/Terms'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <LanguageProvider>
      <Site />
    </LanguageProvider>
  )
}

function Site() {
  const { s, t } = useLang()
  const [gate, setGate] = useState<GateState>(() => readGateState())
  const [, setClockReady] = useState(false)

  // Pull the server clock once so the tickets countdown and the campaign-closed state
  // don't trust the device clock (spec §3.5). Re-render when it lands.
  useEffect(() => {
    let alive = true
    syncServerTime().then(() => alive && setClockReady(true))
    return () => {
      alive = false
    }
  }, [])

  // Nothing below the gate renders — not hidden, not present — until it is answered.
  if (gate !== 'confirmed') {
    return <AgeGate onResolve={setGate} />
  }

  return (
    <>
      <a className="skip-link" href="#entry">
        {t(s.meta.skipToForm)}
      </a>

      <SiteHeader />

      <main>
        <Hero />
        <Tickets />
        <CodeEntry />
        <HowItWorks />
        <Activations />
        <EventsMap />
        <Terms />
      </main>

      <Footer />
    </>
  )
}
