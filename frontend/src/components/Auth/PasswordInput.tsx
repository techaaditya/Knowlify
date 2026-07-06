import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { AuthInput } from './AuthInput';
import { PasswordStrength } from './PasswordStrength';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  valid?: boolean;
  placeholder?: string;
  autoComplete?: string;
  showStrength?: boolean;
  disabled?: boolean;
}

/** Password field with an animated show/hide toggle and optional strength meter. */
export const PasswordInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  onBlur,
  error,
  valid,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  showStrength = false,
  disabled,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <AuthInput
        label={label}
        icon={Lock}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        error={error}
        valid={valid}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        adornment={
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            tabIndex={0}
          >
            <span className={`auth-eye-icon ${visible ? 'is-visible' : ''}`}>
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </span>
          </button>
        }
      />
      {showStrength && <PasswordStrength password={value} />}
    </div>
  );
};
