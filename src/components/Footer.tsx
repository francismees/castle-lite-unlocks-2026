import { useLang } from '../i18n/LanguageContext'
import { campaign } from '../config/campaign'
import { CastleLiteLogo } from './BrandMark'

/**
 * Persistent footer — mandatory compliance load (spec §0 job 3):
 * responsible-drinking line, 18+ mark, licence number, and D3 attribution
 * (TBL is the promoter and licence holder; Bluetrain is the technology partner).
 */
export function Footer() {
  const { s, t } = useLang()

  return (
    <footer className="footer on-dark">
      <div className="wrap">
        <div className="footer__top">
          <CastleLiteLogo variant="footer" />
          <p className="footer__warn">{t(s.footer.responsible)}</p>
          <span className="footer__age" aria-label={t(s.footer.ageMark)}>
            <span aria-hidden="true">18+</span>
          </span>
        </div>

        <div className="footer__rule" aria-hidden="true" />

        <div className="footer__legal">
          <p lang="en">
            Promotional Lottery Licence No. {campaign.licenceNumber} — {campaign.licenceAuthority}.
          </p>
          <p lang="en">
            © {campaign.promoter} {campaign.copyrightYear}. Promoter: {campaign.promoter}. UTC
            Technology Partner: {campaign.technologyPartner}.
          </p>
        </div>
      </div>
    </footer>
  )
}
