import React from 'react';

interface Props {
  label?: string;
}

export const AuthDivider: React.FC<Props> = ({ label = 'OR continue with' }) => (
  <div className="auth-divider" role="separator" aria-label={label}>
    <span className="auth-divider-line" />
    <span className="auth-divider-label">{label}</span>
    <span className="auth-divider-line" />
  </div>
);
