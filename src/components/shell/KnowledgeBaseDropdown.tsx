import { useState } from 'react';
import './KnowledgeBaseDropdown.css';

const ARTICLES = [
  {
    title: 'Email Allowlisting',
    description: 'Setup email allowlisting',
    icon: 'https://d3p8e1mvy30w84.cloudfront.net/XtreamV2/assets/images/svgs/mail-stacked.svg',
    url: 'https://help.caniphish.com/hc/en-us/articles/360004430516-Allowlisting-Introduction',
  },
  {
    title: 'Direct Email Injection',
    description: 'Bypass the need for allowlisting',
    icon: 'https://d3p8e1mvy30w84.cloudfront.net/XtreamV2/assets/images/svgs/icon-mailbox.svg',
    url: 'https://help.caniphish.com/hc/en-us/articles/13340840238863-Email-Delivery-Providers-Overview',
  },
  {
    title: 'Phishing Emails',
    description: 'Phishing email deep-dive',
    icon: 'https://d3p8e1mvy30w84.cloudfront.net/XtreamV2/assets/images/svgs/library.svg',
    url: 'https://help.caniphish.com/hc/en-us/articles/360004630656-Email-Templates-Introduction',
  },
  {
    title: 'Campaign Setup',
    description: 'Campaign setup walkthrough',
    icon: 'https://d3p8e1mvy30w84.cloudfront.net/XtreamV2/assets/images/svgs/clipboard-text-edit.svg',
    url: 'https://help.caniphish.com/hc/en-us/articles/4404682357391-Campaign-Creation-Interactive-Wizard',
  },
  {
    title: 'Employee Lists',
    description: 'Seamlessly upload employee info',
    icon: 'https://d3p8e1mvy30w84.cloudfront.net/XtreamV2/assets/images/svgs/people-team.svg',
    url: 'https://help.caniphish.com/hc/en-us/articles/360004613816-Employee-List-Introduction',
  },
  {
    title: 'Single Sign-On',
    description: 'Integrate with your auth provider',
    icon: 'https://d3p8e1mvy30w84.cloudfront.net/XtreamV2/assets/images/svgs/scan-person.svg',
    url: 'https://help.caniphish.com/hc/en-us/articles/8261838285967-Single-Sign-On-Introduction',
  },
  {
    title: 'White-Labelling',
    description: 'Use your own branding & domain',
    icon: 'https://d3p8e1mvy30w84.cloudfront.net/XtreamV2/assets/images/svgs/people-home.svg',
    url: 'https://help.caniphish.com/hc/en-us/articles/5288924810511-Platform-White-Labelling',
  },
  {
    title: 'Breach Monitoring',
    description: 'Run daily breach scans',
    icon: 'https://d3p8e1mvy30w84.cloudfront.net/XtreamV2/assets/images/svgs/person-available.svg',
    url: 'https://help.caniphish.com/hc/en-us/articles/8048847099279-Dark-Web-Monitoring-Overview',
  },
];

const QUICK_LINKS = [
  {
    label: 'Platform Pricing',
    url: 'https://caniphish.com/platform/pricing',
  },
  {
    label: 'Platform Status',
    url: 'https://caniphish.com/status',
  },
  {
    label: 'Platform Information',
    url: 'https://caniphish.com/platform/information',
  },
  {
    label: 'Security & Compliance',
    url: 'https://caniphish.com/security',
  },
];

const FREE_RESOURCES = [
  {
    label: 'Free Cyber Security Posters',
    url: 'https://caniphish.com/free-cyber-security-awareness-posters',
  },
  {
    label: 'Free Cyber Security Wallpapers',
    url: 'https://caniphish.com/free-cyber-security-wallpapers',
  },
];

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`kb-chevron ${open ? 'is-open' : ''}`}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function KnowledgeBaseDropdown() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <div
      className={`kb-nav ${open ? 'is-open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <button
        type="button"
        className="kb-nav__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((previous) => !previous)}
      >
        <span>Knowledge Base</span>
        <ChevronIcon open={open} />
      </button>

      <div
        className="kb-mega"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="kb-mega__ambient" aria-hidden="true">
          <span className="kb-orb kb-orb--one" />
          <span className="kb-orb kb-orb--two" />
          <span className="kb-orb kb-orb--three" />
          <span className="kb-mega__grid" />
        </div>

        <div className="kb-mega__inner">

          {/* Header */}

          <div className="kb-mega__header">
            <div>
              <span className="kb-mega__eyebrow">
                PH AUSE RESOURCE CENTER
              </span>

              <h3>
                Knowledge <span>Base.</span>
              </h3>

              <p>
                Everything you need to understand, configure and
                get the most out of your security awareness platform.
              </p>
            </div>

            <a
              href="https://help.caniphish.com/hc/en-us"
              target="_blank"
              rel="noopener noreferrer"
              className="kb-mega__browse"
              onClick={close}
            >
              Browse Knowledge Base
              <ArrowIcon />
            </a>
          </div>

          {/* Article Cards */}

          <div className="kb-mega__content">
            <div className="kb-mega__section-heading">
              <span>Explore resources</span>
              <span className="kb-mega__count">
                {ARTICLES.length} ARTICLES
              </span>
            </div>

            <div className="kb-articles">
              {ARTICLES.map((article, index) => (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kb-article"
                  key={article.title}
                  style={{
                    '--kb-index': index,
                  } as React.CSSProperties}
                  onClick={close}
                >
                  <span className="kb-article__icon">
                    <img
                      src={article.icon}
                      alt=""
                      loading="lazy"
                    />
                  </span>

                  <span className="kb-article__content">
                    <strong>{article.title}</strong>
                    <span>{article.description}</span>
                  </span>

                  <span className="kb-article__arrow">
                    <ArrowIcon />
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Footer */}

          <div className="kb-mega__footer">

            <div className="kb-footer__quick">
              <span className="kb-footer__label">QUICK LINKS</span>

              <div className="kb-footer__links">
                {QUICK_LINKS.map((item) => (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={item.label}
                    onClick={close}
                  >
                    {item.label}
                    <ArrowIcon />
                  </a>
                ))}
              </div>
            </div>

            <div className="kb-footer__resources">
              <span className="kb-footer__label">FREE RESOURCES</span>

              {FREE_RESOURCES.map((item) => (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={item.label}
                  onClick={close}
                >
                  {item.label}
                  <ArrowIcon />
                </a>
              ))}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}