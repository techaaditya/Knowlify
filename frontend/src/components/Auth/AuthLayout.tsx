import React from 'react';

interface Props {
  children: React.ReactNode;
}

const FEATURES = [
  'Turn any document into an interactive knowledge graph',
  'Track mastery in real time with adaptive review',
  'Personalised study sessions built around what you forget',
];

/**
 * Full-screen auth shell: a branded showcase panel on wide viewports and a
 * centered card on every screen. Mirrors the Warm Alabaster design system.
 */
export const AuthLayout: React.FC<Props> = ({ children }) => (
  <div className="auth-shell">
    <aside className="auth-brand-panel" aria-hidden="true">
      <div className="auth-brand-panel-inner">
        <div className="auth-brand-lockup">
          <span className="auth-brand-icon">🧠</span>
          <div>
            <h1>KNOWLIFY</h1>
            <p>Adaptive Cognitive Learning</p>
          </div>
        </div>

        <div className="auth-brand-copy">
          <h2>Learn what matters,<br />remember what you learn.</h2>
          <ul className="auth-feature-list">
            {FEATURES.map((f) => (
              <li key={f}>
                <span className="auth-feature-dot" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-brand-footnote">Trusted by curious minds everywhere.</p>
      </div>
    </aside>

    <main className="auth-main">
      <div className="auth-card-wrap">{children}</div>
    </main>
  </div>
);
