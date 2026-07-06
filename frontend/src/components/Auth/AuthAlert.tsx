import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  kind: 'error' | 'success';
  message: string;
}

/** Inline banner for form-level errors or success messages. */
export const AuthAlert: React.FC<Props> = ({ kind, message }) => (
  <div className={`auth-alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    {kind === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
    <span>{message}</span>
  </div>
);
