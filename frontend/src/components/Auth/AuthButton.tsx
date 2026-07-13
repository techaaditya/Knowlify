import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
}

/** Full-width primary submit button with an inline loading spinner. */
export const AuthButton: React.FC<Props> = ({
  loading = false,
  loadingLabel = 'Please wait…',
  children,
  disabled,
  className = '',
  ...rest
}) => (
  <button
    className={`auth-btn ${className}`}
    disabled={disabled || loading}
    aria-busy={loading}
    {...rest}
  >
    <span className={`auth-btn-content ${loading ? 'is-loading' : ''}`}>{children}</span>
    {loading && (
      <span className="auth-btn-spinner" aria-hidden="true">
        <Loader2 size={18} className="auth-spin" />
        <span>{loadingLabel}</span>
      </span>
    )}
  </button>
);
