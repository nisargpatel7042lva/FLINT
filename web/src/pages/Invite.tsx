import { useState } from 'react';

import type { Challenge } from '../lib/types';

/**
 * Enrolment.
 *
 * Students join by entering the code during the app's normal sign-up — there is
 * no separate account or invitation to accept, because anything a student has
 * to do before training is a place they drop out.
 */
export function Invite({
  challenge,
  enrolled,
  onBack,
}: {
  challenge: Challenge;
  enrolled: number;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const link = `https://kasrat.app/join/${challenge.joinCode}`;
  const poster =
    `Join the ${challenge.name}\n\n` +
    `1. Download Kasrat\n` +
    `2. Enter code ${challenge.joinCode} when you sign up\n` +
    `3. Your first session takes five minutes\n\n` +
    `Runs ${challenge.startDay} to ${challenge.endDay}.`;

  const copy = (label: string, text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
      },
      () => setCopied('Copy failed — select the text manually.'),
    );
  };

  return (
    <div className="shell">
      <div className="row no-print" style={{ marginBottom: 20 }}>
        <button onClick={onBack}>← Back to dashboard</button>
      </div>

      <div className="panel" style={{ maxWidth: 620 }}>
        <h1>Invite students</h1>
        <p className="muted" style={{ marginTop: 8, marginBottom: 22 }}>
          {enrolled} students have joined so far.
        </p>

        <h3>Join code</h3>
        <div className="row" style={{ margin: '10px 0 6px' }}>
          <span className="code">{challenge.joinCode}</span>
          <button onClick={() => copy('Code copied', challenge.joinCode)}>Copy</button>
        </div>
        <p className="faint" style={{ marginBottom: 24 }}>
          Students enter this during sign-up in the app. It is the only step —
          they do not need an invitation or an approval.
        </p>

        <h3>Direct link</h3>
        <div className="row" style={{ margin: '10px 0 6px' }}>
          <input readOnly value={link} onFocus={e => e.currentTarget.select()} />
          <button onClick={() => copy('Link copied', link)}>Copy</button>
        </div>
        <p className="faint" style={{ marginBottom: 24 }}>
          Opens the app with the code already filled in, or the store listing if
          it is not installed.
        </p>

        <h3>Text for a notice or WhatsApp group</h3>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
            margin: '10px 0',
          }}>
          {poster}
        </pre>
        <button onClick={() => copy('Text copied', poster)}>Copy text</button>

        {copied ? (
          <p className="faint" style={{ marginTop: 12 }}>
            {copied}
          </p>
        ) : null}
      </div>
    </div>
  );
}
