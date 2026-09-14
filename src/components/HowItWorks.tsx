import { useLang } from '../i18n/LanguageContext'
import { PrizeMarquee } from './PrizeMarquee'

/**
 * Section 4 — How It Works, and what you can unlock by doing it.
 *
 * The four steps, then the prizes they lead to in a full-width band (PrizeMarquee): the
 * cash prizes (instant and weekly draws, D2/D6) and the Extra Cold merchandise prizes.
 * The steps are an ordered list so the sequence survives without the visual stepper.
 */

export function HowItWorks() {
  const { s, t } = useLang()

  const steps = [
    { title: t(s.how.step1Title), body: t(s.how.step1Body) },
    { title: t(s.how.step2Title), body: t(s.how.step2Body) },
    { title: t(s.how.step3Title), body: t(s.how.step3Body) },
    { title: t(s.how.step4Title), body: t(s.how.step4Body) },
  ]

  return (
    <section className="section section--blue section--how on-dark" id="how" aria-labelledby="how-h2">
      <div className="wrap">
        <div className="section__head">
          <h2 id="how-h2">{t(s.how.h2)}</h2>
        </div>

        <ol className="steps">
          {steps.map((step, i) => (
            <li className="step" key={step.title}>
              <span className="step__num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <PrizeMarquee />
    </section>
  )
}
