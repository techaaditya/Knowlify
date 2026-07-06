import React, { useState } from 'react';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import { AuthLayout } from '../../components/Auth/AuthLayout';
import { AuthInput } from '../../components/Auth/AuthInput';
import { AuthButton } from '../../components/Auth/AuthButton';
import { AuthAlert } from '../../components/Auth/AuthAlert';
import { isEmail, useShake, validateEmail } from '../../components/Auth/validation';
import { navigateAuth } from '../../store/authNav';
import { authErrorMessage, forgotPasswordRequest } from '../../api/auth';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [shaking, shake] = useShake();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateEmail(email);
    setError(validationError);
    if (validationError) {
      shake();
      return;
    }

    setServerError(null);
    setLoading(true);
    try {
      const res = await forgotPasswordRequest(email.trim().toLowerCase());
      setDevToken(res.reset_token ?? null);
      setSent(true);
    } catch (err) {
      setServerError(authErrorMessage(err));
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className={`auth-card ${shaking ? 'auth-shake' : ''}`}>
        {sent ? (
          <div className="auth-success-state">
            <span className="auth-success-icon">
              <MailCheck size={30} />
            </span>
            <h1 className="auth-title">Check your inbox</h1>
            <p className="auth-subtitle">
              If an account exists for <strong>{email.trim().toLowerCase()}</strong>, we&apos;ve sent a link
              to reset your password.
            </p>

            {devToken && (
              <div className="auth-dev-hint">
                <span>No email service is configured in dev.</span>
                <button
                  type="button"
                  className="auth-link strong"
                  onClick={() => {
                    window.history.pushState({}, '', `/reset-password?token=${devToken}`);
                    navigateAuth('reset-password');
                  }}
                >
                  Open reset link →
                </button>
              </div>
            )}

            <button type="button" className="auth-back" onClick={() => navigateAuth('login')}>
              <ArrowLeft size={16} /> Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="auth-card-head">
              <span className="auth-card-badge">🧠</span>
              <h1 className="auth-title">Forgot password?</h1>
              <p className="auth-subtitle">Enter your email and we&apos;ll send you a reset link.</p>
            </div>

            {serverError && <AuthAlert kind="error" message={serverError} />}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <AuthInput
                label="Email address"
                type="email"
                icon={Mail}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                onBlur={() => setError(validateEmail(email))}
                error={error}
                valid={isEmail(email)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
              />

              <AuthButton type="submit" loading={loading} loadingLabel="Sending…">
                Send Reset Link
              </AuthButton>
            </form>

            <button type="button" className="auth-back" onClick={() => navigateAuth('login')}>
              <ArrowLeft size={16} /> Back to sign in
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
};
