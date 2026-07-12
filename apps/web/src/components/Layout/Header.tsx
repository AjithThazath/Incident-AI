import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import appInfo from '../../config/app-info.json';
import './Header.css';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/chat': 'AI Incident Analyst',
  '/settings': 'Settings',
};

export default function Header() {
  const location = useLocation();
  const { state, dispatch } = useAppContext();
  const [showInfo, setShowInfo] = useState(true);

  const title = pageTitles[location.pathname] || (
    location.pathname.startsWith('/incidents/') ? 'Incident Detail' : 'IncidentIQ'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  return (
    <header className="header">
      <div className="header__left">
        <button
          className="header__hamburger"
          onClick={() => dispatch({ type: 'TOGGLE_MOBILE_SIDEBAR' })}
          aria-label="Toggle menu"
        >
          <span className="header__hamburger-line" />
          <span className="header__hamburger-line" />
          <span className="header__hamburger-line" />
        </button>
        <h1 className="header__title">{title}</h1>
      </div>
      <div className="header__right">
        <div className="header__info-wrapper">
          <button
            className="header__connect-btn"
            onClick={() => setShowInfo(!showInfo)}
          >
            <span className="header__connect-icon">🔗</span>
            <span className="header__connect-text">Connect with Developer</span>
          </button>
          {showInfo && (
            <>
              <div className="header__info-backdrop" onClick={() => setShowInfo(false)} />
              <div className="header__info-dialog">
                <button className="header__info-close" onClick={() => setShowInfo(false)} aria-label="Close">✕</button>
                <div className="header__info-top">
                  <h3>{appInfo.projectName}</h3>
                  <p className="header__info-subtitle">{appInfo.tagline}</p>
                </div>
                <div className="header__info-columns">
                  <div className="header__info-left">
                    <p className="header__info-intro">{appInfo.intro}</p>
                    <div className="header__info-connect">
                      <h4 className="header__info-section-title">Connect with Developer</h4>
                      <span className="header__info-connect-name">{appInfo.developer.name}</span>
                      <a
                        className="header__info-linkedin"
                        href={appInfo.developer.linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3A1.97 1.97 0 0 0 3.3 4.98c0 1.1.86 1.98 1.93 1.98h.02c1.1 0 1.98-.88 1.98-1.98A1.97 1.97 0 0 0 5.25 3ZM20.7 13.4c0-3.4-1.82-4.98-4.25-4.98-1.96 0-2.83 1.08-3.32 1.84V8.5H9.75c.04 1.17 0 11.5 0 11.5h3.38v-6.42c0-.34.03-.68.13-.92.27-.68.88-1.38 1.9-1.38 1.34 0 1.87 1.03 1.87 2.54V20H20.4v-6.6Z" />
                        </svg>
                        Connect on LinkedIn
                      </a>
                      <a
                        className="header__info-github"
                        href={appInfo.developer.github}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.19-3.37-1.19-.46-1.16-1.12-1.47-1.12-1.47-.92-.62.07-.6.07-.6 1.02.07 1.55 1.05 1.55 1.05.9 1.56 2.37 1.11 2.95.85.09-.66.35-1.11.64-1.36-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-2 1.03-2.7-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.5 9.5 0 0 1 12 6.84c.85 0 1.7.11 2.5.33 1.9-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.7 0 3.85-2.35 4.69-4.58 4.94.36.31.68.93.68 1.88v2.79c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
                        </svg>
                        Checkout my GitHub
                      </a>
                    </div>
                  </div>
                  <div className="header__info-right">
                    <h4 className="header__info-section-title">Key Features</h4>
                    <ul className="header__info-features">
                      {appInfo.features.map((feature, i) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>
                    <div className="header__info-tech">
                      <strong>Tech Stack:</strong> {appInfo.techStack}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <button
          className="header__btn"
          onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
          title="Toggle dark mode"
        >
          {state.darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
