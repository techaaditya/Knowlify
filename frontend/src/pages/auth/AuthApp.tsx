import React from 'react';
import { useAuthRoute } from '../../store/authNav';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';

/** Client-side switch between the four auth screens with a page transition. */
export const AuthApp: React.FC = () => {
  const route = useAuthRoute();

  const page = (() => {
    switch (route) {
      case 'signup':
        return <SignupPage />;
      case 'forgot-password':
        return <ForgotPasswordPage />;
      case 'reset-password':
        return <ResetPasswordPage />;
      case 'login':
      default:
        return <LoginPage />;
    }
  })();

  // `key` restarts the enter animation on every route change.
  return (
    <div className="auth-page-transition" key={route}>
      {page}
    </div>
  );
};
