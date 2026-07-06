import React, { useState } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../../components/Auth/AuthLayout';
import { AuthInput } from '../../components/Auth/AuthInput';
import { PasswordInput } from '../../components/Auth/PasswordInput';
import { AuthButton } from '../../components/Auth/AuthButton';
import { AuthDivider } from '../../components/Auth/AuthDivider';
import { GoogleButton } from '../../components/Auth/GoogleButton';
import { AuthAlert } from '../../components/Auth/AuthAlert';
import { isEmail, useShake, validateEmail, validatePassword } from '../../components/Auth/validation';
import { useAuthStore } from '../../store/authStore';
import { navigateAuth } from '../../store/authNav';
import { authErrorMessage } from '../../api/auth';

export const LoginPage: React.FC = () => {
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shaking, shake] = useShake();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      shake();
      return;
    }

    setServerError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password, remember);
    } catch (err) {
      setServerError(authErrorMessage(err, 'Incorrect email or password.'));
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setServerError(null);
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setServerError(authErrorMessage(err));
    }
  };

  return (
    <AuthLayout>
      <div className={`auth-card ${shaking ? 'auth-shake' : ''}`}>
        <div className="auth-card-head">
          <span className="auth-card-badge">🧠</span>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to continue to your workspace.</p>
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
              if (errors.email) setErrors((p) => ({ ...p, email: null }));
            }}
            onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(email) }))}
            error={errors.email}
            valid={isEmail(email)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={loading}
          />

          <PasswordInput
            label="Password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (errors.password) setErrors((p) => ({ ...p, password: null }));
            }}
            onBlur={() => setErrors((p) => ({ ...p, password: validatePassword(password) }))}
            error={errors.password}
            autoComplete="current-password"
            disabled={loading}
          />

          <div className="auth-row-between">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className="auth-checkbox-box" aria-hidden="true" />
              Remember me
            </label>
            <button type="button" className="auth-link" onClick={() => navigateAuth('forgot-password')}>
              Forgot password?
            </button>
          </div>

          <AuthButton type="submit" loading={loading} loadingLabel="Signing in…">
            Sign In <ArrowRight size={17} />
          </AuthButton>
        </form>

        <AuthDivider />
        <GoogleButton onCredential={handleGoogle} text="signin_with" />

        <p className="auth-switch">
          Don&apos;t have an account?{' '}
          <button type="button" className="auth-link strong" onClick={() => navigateAuth('signup')}>
            Create Account
          </button>
        </p>
      </div>
    </AuthLayout>
  );
};
