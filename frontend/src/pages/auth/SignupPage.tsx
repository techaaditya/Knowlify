import React, { useState } from 'react';
import { Mail, User, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../../components/Auth/AuthLayout';
import { AuthInput } from '../../components/Auth/AuthInput';
import { PasswordInput } from '../../components/Auth/PasswordInput';
import { AuthButton } from '../../components/Auth/AuthButton';
import { AuthDivider } from '../../components/Auth/AuthDivider';
import { GoogleButton } from '../../components/Auth/GoogleButton';
import { AuthAlert } from '../../components/Auth/AuthAlert';
import {
  isEmail,
  useShake,
  validateEmail,
  validateName,
  validatePassword,
} from '../../components/Auth/validation';
import { useAuthStore } from '../../store/authStore';
import { navigateAuth } from '../../store/authNav';
import { authErrorMessage } from '../../api/auth';

export const SignupPage: React.FC = () => {
  const signup = useAuthStore((s) => s.signup);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string | null; email?: string | null; password?: string | null }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shaking, shake] = useShake();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.email || nextErrors.password) {
      shake();
      return;
    }

    setServerError(null);
    setLoading(true);
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password);
    } catch (err) {
      setServerError(authErrorMessage(err, 'Could not create your account.'));
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
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Start turning documents into knowledge.</p>
        </div>

        {serverError && <AuthAlert kind="error" message={serverError} />}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <AuthInput
            label="Full name"
            type="text"
            icon={User}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((p) => ({ ...p, name: null }));
            }}
            onBlur={() => setErrors((p) => ({ ...p, name: validateName(name) }))}
            error={errors.name}
            valid={name.trim().length > 0 && !errors.name}
            placeholder="Ada Lovelace"
            autoComplete="name"
            disabled={loading}
          />

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
            autoComplete="new-password"
            showStrength
            disabled={loading}
          />

          <AuthButton type="submit" loading={loading} loadingLabel="Creating account…">
            Create Account <ArrowRight size={17} />
          </AuthButton>
        </form>

        <AuthDivider />
        <GoogleButton onCredential={handleGoogle} text="signup_with" />

        <p className="auth-switch">
          Already have an account?{' '}
          <button type="button" className="auth-link strong" onClick={() => navigateAuth('login')}>
            Sign In
          </button>
        </p>
      </div>
    </AuthLayout>
  );
};
