import React from 'react';

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  key: 'empty' | 'weak' | 'fair' | 'good' | 'strong';
}

/** Lightweight, dependency-free password strength heuristic. */
export const scorePassword = (pw: string): StrengthResult => {
  if (!pw) return { score: 0, label: '', key: 'empty' };

  let points = 0;
  if (pw.length >= 8) points++;
  if (pw.length >= 12) points++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points++;
  if (/\d/.test(pw)) points++;
  if (/[^A-Za-z0-9]/.test(pw)) points++;

  // Map raw points (0–5) onto a 1–4 visible scale for short passwords.
  if (pw.length < 8) return { score: 1, label: 'Too short', key: 'weak' };
  if (points <= 2) return { score: 2, label: 'Fair', key: 'fair' };
  if (points === 3) return { score: 3, label: 'Good', key: 'good' };
  return { score: 4, label: 'Strong', key: 'strong' };
};

interface Props {
  password: string;
}

export const PasswordStrength: React.FC<Props> = ({ password }) => {
  const { score, label, key } = scorePassword(password);
  if (!password) return null;

  return (
    <div className="auth-strength" aria-live="polite">
      <div className="auth-strength-track">
        {[1, 2, 3, 4].map((seg) => (
          <span
            key={seg}
            className={`auth-strength-seg ${seg <= score ? `filled ${key}` : ''}`}
          />
        ))}
      </div>
      <span className={`auth-strength-label ${key}`}>{label}</span>
    </div>
  );
};
