import React, { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface Props {
  /** Called with the Google ID token on success. */
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  disabled?: boolean;
}

/** Official Google multicolor "G" mark for the fallback button. */
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
    <path d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" fill="#FBBC05" />
    <path d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
  </svg>
);

const loadGsi = (() => {
  let promise: Promise<void> | null = null;
  return () => {
    if (promise) return promise;
    promise = new Promise<void>((resolve, reject) => {
      if ((window as any).google?.accounts?.id) return resolve();
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google sign-in.'));
      document.head.appendChild(script);
    });
    return promise;
  };
})();

export const GoogleButton: React.FC<Props> = ({ onCredential, text = 'continue_with', disabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res: { credential?: string }) => {
            if (res.credential) onCredential(res.credential);
          },
        });
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(containerRef.current.offsetWidth || 360, 400),
        });
        setReady(true);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [onCredential, text]);

  // When configured, render the official Google button.
  if (GOOGLE_CLIENT_ID && !failed) {
    return (
      <div className="auth-google-slot" aria-busy={!ready}>
        <div ref={containerRef} className="auth-google-render" />
        {!ready && (
          <button type="button" className="auth-social-btn" disabled>
            <GoogleG />
            <span>Loading Google…</span>
          </button>
        )}
      </div>
    );
  }

  // Fallback: styled button when no client id is configured (dev) or GSI failed.
  const label = text === 'signup_with' ? 'Sign up with Google' : text === 'signin_with' ? 'Sign in with Google' : 'Continue with Google';
  return (
    <button
      type="button"
      className="auth-social-btn"
      disabled={disabled}
      title={GOOGLE_CLIENT_ID ? 'Google sign-in unavailable' : 'Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in'}
      onClick={() =>
        alert(
          GOOGLE_CLIENT_ID
            ? 'Google sign-in is temporarily unavailable. Please try again.'
            : 'Google sign-in is not configured yet.\n\nAdd VITE_GOOGLE_CLIENT_ID (frontend) and GOOGLE_CLIENT_ID (backend) to enable it.',
        )
      }
    >
      <GoogleG />
      <span>{label}</span>
    </button>
  );
};
