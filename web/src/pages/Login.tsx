import { useState } from 'react';

import { isDemoMode, signIn, type AdminSession } from '../lib/adminAuth';

/** Coordinator sign-in. Separate surface from the student app's auth. */
export function Login({ onSignedIn }: { onSignedIn: (s: AdminSession) => void }) {
  const [email, setEmail] = useState('wellness@svitvasad.ac.in');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onSignedIn(await signIn(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{ marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 20 }}>
            Kasrat <span className="muted" style={{ fontWeight: 400 }}>for Colleges</span>
          </div>
          <p className="faint" style={{ marginTop: 6 }}>
            Programme dashboard for wellness coordinators.
          </p>
        </div>

        <form className="panel" onSubmit={submit}>
          <h2 style={{ marginBottom: 16 }}>Sign in</h2>

          {isDemoMode() ? (
            <div className="banner">
              <strong>Demo mode.</strong> No Firebase project is configured, so
              any password is accepted and the data below is generated. Do not
              use this to make real decisions.
            </div>
          ) : null}

          {error ? <p className="error">{error}</p> : null}

          <div className="field">
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="At least 6 characters"
            />
          </div>

          <button className="primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="faint" style={{ marginTop: 14 }}>
            Coordinator accounts are created by Kasrat. This is separate from the
            student app — a student account cannot sign in here.
          </p>
        </form>
      </div>
    </div>
  );
}
