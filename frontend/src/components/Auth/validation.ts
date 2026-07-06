import { useCallback, useState } from 'react';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const validateName = (name: string): string | null => {
  if (!name.trim()) return 'Please enter your full name.';
  return null;
};

export const validateEmail = (email: string): string | null => {
  if (!email.trim()) return 'Please enter your email address.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return 'Please enter a password.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
};

export const isEmail = (email: string): boolean => EMAIL_RE.test(email.trim());

/** Triggers a one-shot shake animation flag for invalid submissions. */
export const useShake = (): [boolean, () => void] => {
  const [shaking, setShaking] = useState(false);
  const shake = useCallback(() => {
    setShaking(false);
    // Restart the animation on the next frame.
    requestAnimationFrame(() => {
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
    });
  }, []);
  return [shaking, shake];
};
