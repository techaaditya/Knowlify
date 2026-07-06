import React, { useId } from 'react';
import { LucideIcon, Check } from 'lucide-react';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  icon?: LucideIcon;
  error?: string | null;
  /** Show a success tick (e.g. valid email/matching password). */
  valid?: boolean;
  /** Optional element rendered on the right (e.g. password eye toggle). */
  adornment?: React.ReactNode;
}

/**
 * Labelled text input with a leading icon, focus ring, and inline error /
 * success states. Fully keyboard + screen-reader accessible.
 */
export const AuthInput: React.FC<Props> = ({
  label,
  icon: Icon,
  error,
  valid,
  adornment,
  className = '',
  ...inputProps
}) => {
  const id = useId();
  const errorId = `${id}-error`;
  const state = error ? 'error' : valid ? 'valid' : '';

  return (
    <div className={`auth-field ${state} ${className}`}>
      <label htmlFor={id} className="auth-label">
        {label}
      </label>
      <div className="auth-input-wrap">
        {Icon && <Icon className="auth-input-icon" size={17} aria-hidden="true" />}
        <input
          id={id}
          className="auth-input"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        {valid && !adornment && (
          <span className="auth-input-adornment auth-valid-tick" aria-hidden="true">
            <Check size={16} />
          </span>
        )}
        {adornment && <span className="auth-input-adornment">{adornment}</span>}
      </div>
      <div className="auth-error-slot" aria-live="polite">
        {error && (
          <span id={errorId} className="auth-error-text" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
};
