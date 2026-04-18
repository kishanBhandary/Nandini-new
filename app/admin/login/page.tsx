'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiError, parseApiPayload } from '../../../lib/apiResponse';

const REMEMBERED_ADMIN_KEY = 'nandini:remembered-admin-username';

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M2 12c1.73-4.4 5.77-7 10-7s8.27 2.6 10 7c-1.73 4.4-5.77 7-10 7S3.73 16.4 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.73 5.08A10.45 10.45 0 0 1 12 5c4.23 0 8.27 2.6 10 7a15.28 15.28 0 0 1-3.04 4.58"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.61 6.61C4.27 8.02 2.78 10.1 2 12c1.73 4.4 5.77 7 10 7 1.47 0 2.88-.27 4.14-.76"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.88 9.88A3.2 3.2 0 0 0 12 15.2c1.77 0 3.2-1.43 3.2-3.2 0-.3-.04-.6-.12-.88"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminLoginScreenPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockEnabled, setCapsLockEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [error, setError] = useState('');

  const trimmedUsername = username.trim();
  const canSubmit = useMemo(() => trimmedUsername.length > 0 && password.length > 0 && !loading, [trimmedUsername, password, loading]);

  useEffect(() => {
    const rememberedUsername = window.localStorage.getItem(REMEMBERED_ADMIN_KEY);
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      setRememberUsername(true);
    }
  }, []);

  const updateCapsLockState = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockEnabled(event.getModifierState('CapsLock'));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setCapsLockEnabled(false);

    if (!trimmedUsername) {
      setError('Please enter your username.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password, role: 'ADMIN' }),
      });

      const data = await parseApiPayload(response);

      if (!response.ok) {
        setError(getApiError(data, 'Unable to login.'));
        setFailedAttempts((prev) => prev + 1);
        return;
      }

      if (rememberUsername) {
        window.localStorage.setItem(REMEMBERED_ADMIN_KEY, trimmedUsername);
      } else {
        window.localStorage.removeItem(REMEMBERED_ADMIN_KEY);
      }

      router.push('/admin');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
      setFailedAttempts((prev) => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell admin-login-page">
      <div className="admin-login-stage" aria-hidden="true">
        <span className="admin-login-orb orb-one" />
        <span className="admin-login-orb orb-two" />
        <span className="admin-login-orb orb-three" />
      </div>

      <section className="auth-panel admin-login-panel" aria-label="Admin login form">
        <div className="admin-login-badge-row">
          <p className="admin-login-brand">Nandini Enterprises</p>
        </div>

        <div className="admin-login-header">
          <h1 className="auth-title admin-login-title">Welcome back</h1>
          <div className="admin-portal-switch" role="tablist" aria-label="Choose role">
            <button type="button" className="admin-portal-tab active" role="tab" aria-selected="true" aria-current="page">
              Admin
            </button>
            <button
              type="button"
              className="admin-portal-tab"
              role="tab"
              aria-selected="false"
              onClick={() => router.push('/worker/login')}
            >
              Worker
            </button>
          </div>
        </div>

        <form className="auth-form screenshot-style" onSubmit={handleSubmit}>
          <div className="form-field auth-field">
            <label htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </div>

          <div className="form-field auth-field">
            <label htmlFor="admin-password">Password</label>
            <div className="admin-password-wrap">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={updateCapsLockState}
                onKeyUp={updateCapsLockState}
                onBlur={() => setCapsLockEnabled(false)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {capsLockEnabled ? <p className="auth-helper-warning">Caps Lock is on.</p> : null}
          </div>

          <div className="auth-row admin-login-controls-row">
            <label className="auth-remember" htmlFor="remember-admin-username">
              <input
                id="remember-admin-username"
                type="checkbox"
                checked={rememberUsername}
                onChange={(event) => setRememberUsername(event.target.checked)}
              />
              Remember username
            </label>
          </div>

          <button className="auth-submit admin-login-submit" type="submit" disabled={!canSubmit}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          {failedAttempts >= 3 ? (
            <p className="auth-helper-muted">
              Multiple failed attempts detected. Confirm your role and credentials before trying again.
            </p>
          ) : null}
        </form>

        {error ? (
          <div className="status error auth-status" role="alert" aria-live="polite">
            {error}
          </div>
        ) : null}

      </section>
    </main>
  );
}
