import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '../../components/Auth/AuthLayout';
import { PasswordInput } from '../../components/Auth/PasswordInput';
import { AuthButton } from '../../components/Auth/AuthButton';
import { AuthAlert } from '../../components/Auth/AuthAlert';
import { useShake, validatePassword } from '../../components/Auth/validation';
import { useAuthStore } from '../../store/authStore';
import { getQueryParam, navigateAuth } from '../../store/authNav';
import { authErrorMessage, resetPasswordRequest } from '../../api/auth';

export const ResetPasswordPage: React.FC = () => {
  const setSession = useAuthStore((s) => s.setSession);
  const token = getQueryParam('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shaking, shake] = useShake();

  const confirmError = (): string | null => {
    if (!confirm) return 'Please confirm your password.';
    if (confirm !== password) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = { password: validatePassword(password), confirm: confirmError() };
    setErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirm) {
      shake();
      return;
    }

    setServerError(null);
    setLoading(true);
    try {
      const res = await resetPasswordRequest(token as string, password);
      // Reset succeeded — sign the user straight in.
      setSession(res, true);
    } catch (err) {
      setServerError(authErrorMessage(err, 'This reset link is invalid or has expired.'));
      shake();
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <div className="auth-card-head">
            <span className="auth-card-badge">🧠</span>
            <h1 className="auth-title">Invalid reset link</h1>
            <p className="auth-subtitle">This link is missing or malformed. Request a new one to continue.</p>
          </div>
          <AuthButton type="button" onClick={() => navigateAuth('forgot-password')}>
            Request new link
          </AuthButton>
          <button type="button" className="auth-back" onClick={() => navigateAuth('login')}>
            <ArrowLeft size={16} /> Back to sign in
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={`auth-card ${shaking ? 'auth-shake' : ''}`}>
        <div className="auth-card-head">
          <span className="auth-card-badge accent">
            <ShieldCheck size={22} />
          </span>
          <h1 className="auth-title">Set a new password</h1>
          <p className="auth-subtitle">Choose a strong password you don&apos;t use elsewhere.</p>
        </div>

        {serverError && <AuthAlert kind="error" message={serverError} />}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <PasswordInput
            label="New password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (errors.password) setErrors((p) => ({ ...p, password: null }));
            }}
            onBlur={() => setErrors((p) => ({ ...p, password: validatePassword(password) }))}
            error={errors.password}
            autoComplete="new-password"
            showStrength
            disabled={loading}
          />

          <PasswordInput
            label="Confirm password"
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              if (errors.confirm) setErrors((p) => ({ ...p, confirm: null }));
            }}
            onBlur={() => setErrors((p) => ({ ...p, confirm: confirmError() }))}
            error={errors.confirm}
            valid={confirm.length > 0 && confirm === password}
            autoComplete="new-password"
            disabled={loading}
          />

          <AuthButton type="submit" loading={loading} loadingLabel="Resetting…">
            Reset Password
          </AuthButton>
        </form>

        <button type="button" className="auth-back" onClick={() => navigateAuth('login')}>
          <ArrowLeft size={16} /> Back to sign in
        </button>
      </div>
    </AuthLayout>
  );
};
