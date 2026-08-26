import { useState } from 'react';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Summary } from './pages/Summary';
import { Invite } from './pages/Invite';
import { CreateChallenge } from './pages/CreateChallenge';
import { currentSession, isDemoMode, signOut, type AdminSession } from './lib/adminAuth';
import { CHALLENGE, COLLEGE, LOGS, STUDENTS, TODAY } from './lib/mockData';
import type { Challenge } from './lib/types';

type View = 'dashboard' | 'summary' | 'invite' | 'create';

/**
 * App shell.
 *
 * View state rather than a router: there are four screens and no deep-linking
 * requirement, so react-router would be more dependency than navigation.
 */
export default function App() {
  const [session, setSession] = useState<AdminSession | null>(currentSession);
  const [challenge, setChallenge] = useState<Challenge>(CHALLENGE);
  const [view, setView] = useState<View>('dashboard');

  if (!session) {
    return <Login onSignedIn={setSession} />;
  }

  return (
    <>
      <header className="topbar no-print">
        <div className="topbar-inner">
          <span className="brand">Kasrat</span>
          <span className="muted">{session.collegeName}</span>
          <div className="spacer" />
          <button onClick={() => setView('create')}>New challenge</button>
          <button
            onClick={() => {
              signOut();
              setSession(null);
            }}>
            Sign out
          </button>
        </div>
      </header>

      {isDemoMode() ? (
        <div className="shell no-print">
          <div className="banner">
            <strong>Demo data.</strong> No Firebase project is configured, so this
            cohort is generated. Figures are illustrative and must not be used in
            a real report.
          </div>
        </div>
      ) : null}

      {view === 'create' ? (
        <CreateChallenge
          collegeId={session.collegeId}
          onCreated={c => {
            setChallenge(c);
            setView('dashboard');
          }}
          onCancel={() => setView('dashboard')}
        />
      ) : null}

      {view === 'dashboard' ? (
        <Dashboard
          challenge={challenge}
          students={STUDENTS}
          logs={LOGS}
          today={TODAY}
          onOpenSummary={() => setView('summary')}
          onOpenInvite={() => setView('invite')}
        />
      ) : null}

      {view === 'summary' ? (
        <Summary
          college={COLLEGE}
          challenge={challenge}
          students={STUDENTS}
          logs={LOGS}
          today={TODAY}
          onBack={() => setView('dashboard')}
        />
      ) : null}

      {view === 'invite' ? (
        <Invite
          challenge={challenge}
          enrolled={STUDENTS.length}
          onBack={() => setView('dashboard')}
        />
      ) : null}
    </>
  );
}
