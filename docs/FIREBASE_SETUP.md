# Firebase setup

Everything in the app is written and wired. The one missing piece is a Firebase
project, which only you can create — it needs your Google account.

Until `google-services.json` exists the app still builds and runs on local
fixtures. The Friends screen says which backend is live in its subtitle, so you
never have to guess.

Budget about 20 minutes. Steps 1–6 are the console; 7–10 are your terminal.

---

## Before you start: the one surprise

**Cloud Functions requires the Blaze (pay-as-you-go) plan.** Firestore, Auth and
Cloud Messaging all work on the free Spark plan, but `onPokeCreated` — the
function that actually makes a friend's phone buzz — will not deploy without
Blaze, and Blaze needs a card on file.

Blaze keeps the free quotas and only bills past them. For two people testing
nudges the usage is effectively zero. Set a budget alert anyway (step 6).

If you would rather not add a card: everything except the push still works.
Nudges write to Firestore and appear in the recipient's in-app inbox next time
they open the app. Only the buzz is missing.

---

## 1. Create the project

1. <https://console.firebase.google.com> → **Create a project**.
2. Name it `Kasrat`. The project *id* underneath becomes something like
   `kasrat-1a2b3` — note it, you need it in step 7.
3. Google Analytics: **not required**. Turn it off unless you want it; nothing
   here uses it and it adds a consent step.
4. **Create project** → wait → **Continue**.

---

## 2. Register the Android app

1. Project overview → the **Android** icon (or **Add app** → Android).
2. **Android package name** — must match exactly:

   ```
   com.kasrat
   ```

   A typo here produces an app that builds fine and silently never connects.
3. App nickname: `Kasrat` (optional).
4. **Debug signing certificate SHA-1: leave blank for now.** It is only needed
   for Google Sign-In and phone auth, neither of which is wired up. You can add
   it later without recreating the app. When you do need it, this repo's
   committed debug keystore is:

   ```
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```

   Re-derive it yourself with:

   ```bash
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   Your **release** keystore has a different SHA-1. Add that one too before
   shipping, or Google sign-in fails in production only.
5. **Register app**, then **download `google-services.json`**.
6. Put it here — the exact path matters:

   ```
   android/app/google-services.json
   ```

   The Gradle plugin switches itself on when that file exists (see the top of
   `android/app/build.gradle`), so there is nothing else to edit.
7. Skip the remaining "add the SDK" console steps — those dependencies are
   already in this repo. **Next** → **Continue to console**.

**Never commit this file.** It is already git-ignored. It is not a secret in the
password sense, but it identifies your project.

---

## 3. Create the Firestore database

1. **Build** → **Firestore Database** → **Create database**.
2. **Choose the location carefully — it is permanent.** A Firestore database
   cannot be moved later; you would have to make a new project.
   - In India, pick **`asia-south1` (Mumbai)**.
   - Otherwise pick the region closest to your users.
3. Start in **production mode**. The rules in this repo replace the defaults in
   step 8, and production mode denies everything until then — which is the
   correct state to be in. Test mode leaves the database world-readable for 30
   days.
4. **Create**.

**If you did not choose `asia-south1`**, open `functions/src/index.ts` and change
this line to match:

```ts
setGlobalOptions({ region: 'asia-south1' });
```

A 2nd-gen Firestore trigger deployed to a different region than its database
fails to deploy. This is the most common reason step 9 errors.

---

## 4. Turn on authentication

**Build** → **Authentication** → **Get started** → **Sign-in method**:

- Enable **Anonymous**. This is what the app uses by default — you get a uid
  from first launch, and a nudge has to be addressed to a uid. It is also what
  lets someone train before making an account.
- Enable **Email/Password** as well; `auth.ts` already supports it.

---

## 5. Storage and Cloud Messaging

- **Build** → **Storage** → enable. Used for Team Wars video proof.
- **Cloud Messaging**: nothing to configure. Registering the Android app in
  step 2 already provisioned it, and `google-services.json` carries the
  credentials. You can confirm it under **Engage** → **Messaging**.

The recipient still has to grant notification permission on their phone
(Android 13+ asks at runtime). Without it, nudges land in the in-app inbox and
the function logs `poke stored but not pushed: no token`.

---

## 6. Upgrade to Blaze, and set a budget alert

1. Bottom of the left sidebar → **Upgrade** → **Blaze**.
2. Link or create a Cloud Billing account.
3. When it offers a **budget alert**, set one. 5 USD is plenty. Take it.

### Will this actually cost anything?

A card is required, but there is no upfront fee, no monthly minimum, and the
free quotas survive the upgrade — Blaze bills only past them.

| Service | Free allowance | Two people testing nudges |
|---|---|---|
| Cloud Functions | 2M invocations/month | one per nudge |
| Firestore | 50k reads + 20k writes **per day** | tens |
| Cloud Messaging | unlimited, always free | — |
| Auth (anonymous, email) | free | — |

Two honest caveats:

- Deploying a 2nd-gen function stores a container image in Artifact Registry,
  and that storage is not entirely free. It is pennies, but it is why a bill
  can read `$0.03` rather than `$0.00`.
- Adding an Indian card may trigger a small temporary authorisation hold that
  is refunded. That is the card network verifying, not a charge.

`setGlobalOptions` in `functions/src/index.ts` caps concurrency at
`maxInstances: 10`. The default is 100, and a trigger bug that rewrites its own
document would otherwise scale a loop as fast as containers can be allocated.
The cap turns that into a slow queue instead of a bill.

**Prefer not to add a card?** Everything except the push notification still
works on the free Spark plan: nudges write to Firestore and appear in the
recipient's in-app inbox next time they open it. Do steps 1–5 and 8, skip 6 and
9.

---

## 7. Point this repo at the project

```bash
npx firebase login
```

```bash
npx firebase use --add
```

Pick your project from the list and give it the alias `default`.

---

## 8. Deploy the rules and indexes

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage
```

Both halves matter:

- The **rules** stop one user reading another's push token, and make the
  once-per-day nudge cap unforgeable.
- The **indexes** let the inbox query (`toUid` + `createdAt`) run at all.
  Without them the Friends screen shows an empty inbox and logs an error
  containing a link to create the missing index.

Indexes take a minute or two to build. **Firestore** → **Indexes** shows
progress.

---

## 9. Deploy the function

```bash
npm --prefix functions run deploy
```

This is the piece that turns a database row into a notification on somebody
else's phone. Expect a few minutes the first time — Google enables several APIs
on the project as part of it.

Confirm it landed:

```bash
npx firebase functions:list
```

You should see `onPokeCreated` in the region from step 3, alongside the
streak jobs.

---

## 10. Rebuild the app

```bash
npx react-native run-android
```

A rebuild is required — `google-services.json` is read at build time, not
runtime. Gradle prints one of these near the start:

```
Firebase: google-services.json found - Firebase enabled.
Firebase: google-services.json MISSING - building without Firebase.
```

If you see MISSING, the file is in the wrong place. It goes in `android/app/`,
not the project root and not `android/`.

---

## Checking it actually works

Open the app → **Squad** tab → the person icon, top right. The subtitle under
"Friends" is the honest indicator:

| What it says | What it means |
|---|---|
| "Nudge someone who's gone quiet — it lands on their phone." | Firebase is connected |
| "Running on local data: nudges are recorded on this device only." | Still on fixtures — file missing, or the app was not rebuilt |

### The real test needs two accounts

One device cannot nudge itself; the rules forbid it, deliberately. Use an
emulator plus your phone, or two emulators.

1. On **both**, go through profile setup and claim a handle. Someone with no
   handle cannot be found and cannot be nudged.
2. On device A: **Add people** → search device B's handle → **Add**.
3. Tap the nudge (hand) icon.
4. Device B should show a notification within a second or two.

Watch it server-side:

```bash
npx firebase functions:log --only onPokeCreated
```

`poke delivered` means it went out. `poke stored but not pushed: no token`
means device B never granted notification permission.

---

## When something is wrong

**"Firebase is not configured. Add android/app/google-services.json and
rebuild."**
The file is missing or misplaced. Check the Gradle line from step 10.

**The inbox is empty and the console logs a long URL.**
The composite index is missing. Re-run step 8, or click the URL in the error —
it creates exactly the index that was needed.

**`Error: Your project must be on the Blaze plan to deploy functions`**
Step 6.

**Function deploy fails mentioning region or location.**
The region in `functions/src/index.ts` does not match the Firestore location you
chose in step 3.

**Nudges save but nothing buzzes.**
In order: is the function deployed (`firebase functions:list`), did the
recipient grant notification permission, and does `users/{their-uid}.fcmToken`
exist in Firestore?

**A nudge is refused.**
Expected in three cases, all deliberate: the recipient has no profile (no handle
claimed), you are nudging yourself, or you already sent that kind of nudge to
that person today.

---

## Verifying the rules without any of this

The security rules are tested against a local emulator and need no project, no
billing and no credentials:

```bash
npm run test:rules
```

25 cases, including "one user can never read another's push token" and "the
daily cap holds even when the client tries to bypass it".

---

## Data model

```
profiles/{uid}                    public: name, handle, handleLower
handles/{handleLower}             uniqueness claim: { uid }
users/{uid}                       private: fcmToken, currentStreak, lastSessionDay
users/{uid}/friends/{friendUid}   private to owner: name, handle, addedAt
users/{uid}/sessions/{day}        SessionLog
pokes/{fromUid_toUid_kind_day}    fromUid, toUid, kind, day, read, createdAt
```

Four deliberate choices:

- **Public profile and private user document are separate.** A nudge needs a
  stranger's name and handle, so those are readable by any signed-in user. The
  FCM token is not, and lives where only its owner and the Admin SDK reach it.
  Conflating the two turns friend search into a way to harvest push tokens.
- **Sessions are a subcollection of the user**, so a rule is one uid comparison
  and cross-user reads are impossible by construction.
- **A session's document id is its calendar day**, so "one session per day" is
  structural rather than client-enforced — which matters because streaks are
  computed from distinct days.
- **A nudge's document id encodes sender, recipient, kind and day**, and the
  rules permit `create` only. The daily cap is therefore a property of the
  database, not a courtesy the client extends.

`currentStreak` is written **only** by Cloud Functions. The rules block clients
from touching it, because a streak a client can write is a streak it can fake.

---

## What is deliberately not client-controlled

- **The push text.** `onPokeCreated` generates it from the nudge's `kind` and
  the *sender's profile name as stored on the server*. The `message` the client
  wrote is ignored for the notification. A client that could choose the text
  landing on a stranger's lock screen would be a harassment channel.
- **The daily cap.** See the data-model note above.
- **Push tokens.** Private to their owner and the Admin SDK.

---

## Still device-local

**Groups.** Creating, joining and membership are persisted on the device only.
Group members are fixture people, so the Nudge button inside a group appears
only for members who are also your friends — people with a real account behind
them. Migrating groups is the same shape of work as friends: a `groups`
collection, a `groupCodes/{code}` lookup so joining does not require listing
every group, and membership rules.

---

## Local development against the emulator suite

```bash
npx firebase emulators:start
```

The app does not currently point at the emulator suite — add
`connectFirestoreEmulator` / `connectAuthEmulator` calls in
`src/services/backend.ts` when you want that. The rules tests
(`npm run test:rules`) drive the emulator directly and need no such wiring.
