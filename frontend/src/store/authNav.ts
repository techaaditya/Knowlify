import { useEffect, useState } from 'react';

export type AuthRoute = 'login' | 'signup' | 'forgot-password' | 'reset-password';

const ROUTES: AuthRoute[] = ['login', 'signup', 'forgot-password', 'reset-password'];

const routeFromPath = (pathname: string): AuthRoute => {
  const slug = pathname.replace(/^\/+/, '').split('/')[0] as AuthRoute;
  return ROUTES.includes(slug) ? slug : 'login';
};

/** Navigate between auth screens with real URLs, no router dependency. */
export const navigateAuth = (route: AuthRoute) => {
  const path = `/${route}${window.location.search}`;
  if (`${window.location.pathname}${window.location.search}` !== path) {
    window.history.pushState({}, '', `/${route}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
};

/** Subscribe to the current auth route (reacts to back/forward + navigateAuth). */
export const useAuthRoute = (): AuthRoute => {
  const [route, setRoute] = useState<AuthRoute>(() => routeFromPath(window.location.pathname));
  useEffect(() => {
    const onChange = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return route;
};

/** Read a query param (used for the password-reset token). */
export const getQueryParam = (key: string): string | null =>
  new URLSearchParams(window.location.search).get(key);
