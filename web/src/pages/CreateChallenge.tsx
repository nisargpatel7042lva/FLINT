import { useState } from 'react';

import type { Challenge } from '../lib/types';

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Six characters from an alphabet with no lookalikes — this gets read aloud in
 * a lecture hall and typed on a phone.
 *
 * The name-derived prefix is filtered against the SAME alphabet, not just
 * uppercased. "SVIT Vasad" would otherwise yield "SVIT..", and S and I are
 * exactly the characters excluded — the app's validator rejects them, so the
 * dashboard would have been handing out codes its own app refused.
 */
const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY349'; // no I/O/S/B/0/1/2/5/8

function generateCode(name: string): string {
  const prefix = name
    .toUpperCase()
    .split('')
    .filter(c => CODE_ALPHABET.includes(c))
    .slice(0, 4)
    .join('');

  const padded = (prefix + 'KART').slice(0, 4);

  let suffix = '';
  for (let i = 0; i < 2; i += 1) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${padded}${suffix}`;
}

export function CreateChallenge({
  collegeId,
  onCreated,
  onCancel,
}: {
  collegeId: string;
  onCreated: (c: Challenge) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState('30-Day Campus Fitness Challenge');
  const [startDay, setStartDay] = useState(today);
  const [days, setDays] = useState(30);
  const [code, setCode] = useState(() => generateCode('SVIT'));

  const endDay = addDays(startDay, days - 1);
  const valid = name.trim().length >= 3 && days >= 7 && days <= 90;

  return (
    <div className="shell">
      <div className="panel" style={{ maxWidth: 620, margin: '0 auto' }}>
        <h1>Create a challenge</h1>
        <p className="muted" style={{ marginTop: 8, marginBottom: 22 }}>
          Students join with the code below during sign-up. Everyone who joins is
          counted in this programme's results.
        </p>

        <div className="field">
          <label htmlFor="name">Challenge name</label>
          <input id="name" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="start">Start date</label>
            <input
              id="start"
              type="date"
              value={startDay}
              onChange={e => setStartDay(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="days">Length</label>
            <select id="days" value={days} onChange={e => setDays(Number(e.target.value))}>
              <option value={14}>14 days</option>
              <option value={21}>21 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>
        </div>

        <p className="faint" style={{ marginBottom: 22 }}>
          Runs {startDay} to {endDay}.
        </p>

        <div className="field">
          <label>Join code</label>
          <div className="row">
            <span className="code">{code}</span>
            <button type="button" onClick={() => setCode(generateCode(name))}>
              Regenerate
            </button>
          </div>
          <p className="faint" style={{ marginTop: 8 }}>
            Avoids characters that are easy to misread aloud (no O, I, S, 0, 1).
          </p>
        </div>

        <div className="row" style={{ marginTop: 24 }}>
          <button
            className="primary"
            disabled={!valid}
            onClick={() =>
              onCreated({
                id: `ch-${Date.now()}`,
                collegeId,
                name: name.trim(),
                startDay,
                endDay,
                joinCode: code,
              })
            }>
            Create challenge
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
