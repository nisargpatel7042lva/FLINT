# Firebase setup

Everything in the app is written and wired. The one missing piece is
`google-services.json`, which can only come from **your** Firebase project —
creating that project requires your Google account, so it is the one step that
has to be done by you.

Until that file exists the app still builds and runs; it falls back to local
data. `Profile → Data` shows which backend is live (`Local` or `Firestore`), so
you never have to guess.

---

## 1. Create the project

1. <https://console.firebase.google.com> → **Add project** → name it `kasrat`.
2. Google Analytics is optional; Cloud Messaging works without it.

## 2. Register the Android app

1. In the project, **Add app → Android**.
2. **Package name must be exactly:**

   ```
   com.kasrat
   ```

   Anything else and Firebase will reject the app at runtime.
3. Add the debug SHA-1 (needed later for Google sign-in and for phone/link
   flows). For this repo's committed debug keystore it is:

   ```
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```

   Verified from the built APK on 2026-08-23. To re-derive it yourself:

   ```bash
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   Your **release** keystore has a different SHA-1 — add that one too before
   shipping, or Google sign-in silently fails in production only.

4. Download `google-services.json` and put it at:

   ```
   android/app/google-services.json
   ```

5. Rebuild. The Gradle log will print `Firebase: google-services.json found`.

> `android/app/google-services.json` is git-ignored. It is not a secret in the
> password sense, but it identifies your project and should not be committed.

## 3. Turn on the services

In the console:

- **Authentication → Sign-in method** → enable **Anonymous** (required: the app
  signs in anonymously so people can train before making an account) and
  **Email/Password**.
- **Firestore Database** → Create database → start in **production mode**
  (the rules in this repo replace the defaults).
- **Storage** → enable.
- **Cloud Messaging** → nothing to enable; it is on by default.

## 4. Deploy rules, indexes and functions

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase use --add
```

Deploy the security rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Then the functions:

```bash
cd functions && npm install && npm run deploy
```

> Cloud Functions require the **Blaze** (pay-as-you-go) plan. The scheduled
> nudges are tiny, but scheduling itself needs Blaze.

## 5. Verify

Run the app, complete a session, then check
**Firestore → users/{uid}/sessions** — there should be one document whose id is
today's date.

---

## Data model

```
users/{userId}                    UserProfile  (name, handle, fcmToken,
                                                currentStreak, lastSessionDay)
users/{userId}/sessions/{day}     SessionLog   (day, title, focus, minutes,
                                                completedSets, totalSets, kcal)
```

Two deliberate choices:

- **Sessions are a subcollection of the user**, so a rule is one uid comparison
  and cross-user reads are impossible by construction.
- **A session's document id is its calendar day.** "One session per day" is
  therefore structural rather than client-enforced — which matters because
  streaks are computed from distinct days.

`currentStreak` is written **only** by Cloud Functions. The security rules
block clients from touching it, because a streak a client can write is a
streak it can fake.

## Local development against emulators

```bash
firebase emulators:start
```

The app does not currently point at the emulator suite — add
`connectFirestoreEmulator` / `connectAuthEmulator` calls in
`src/services/backend.ts` when you want that.

---

## Making nudges actually reach a friend

Everything below is already in the repo. What is missing is `google-services.json`,
which only you can download — it identifies *your* Firebase project, and nothing
in the app can talk to a backend until it exists.

### What has to be true

1. **`android/app/google-services.json` exists**, then rebuild:
   ```
   npx react-native run-android
   ```
   Until then `isFirebaseConfigured()` is false and the app runs on local
   fixtures. The Friends screen says so in its subtitle rather than pretending.

2. **Anonymous auth is enabled** (Authentication → Sign-in method). Every user
   needs a uid from first launch; a nudge is addressed to one.

3. **Rules and indexes are deployed**:
   ```
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```
   The inbox query (`toUid` + `createdAt`) needs the composite index. Without
   it the query fails at runtime with a link to create it.

4. **Functions are deployed**:
   ```
   npm --prefix functions run deploy
   ```
   `onPokeCreated` is what turns a database row into a notification on someone
   else's phone. Without it nudges are stored and shown in-app, but nothing
   buzzes.

5. **Both people have claimed a handle.** Profile setup does this. A nudge is
   refused by the rules unless `profiles/{toUid}` exists, so an account that
   skipped setup cannot be nudged — deliberately, since it also cannot be found.

6. **The recipient granted notification permission**, so `users/{uid}.fcmToken`
   is set. If it is not, the nudge still lands in their in-app inbox; the
   function logs `poke stored but not pushed: no token` and moves on.

### Trying it with two accounts

The quickest honest test needs two installs — an emulator and a phone, or two
emulators. Sign in on both, claim a handle on each, search for the other's
handle, add, and nudge. The receiving device should show a notification within a
second or two.

To watch it happen:
```
npx firebase functions:log --only onPokeCreated
```

### What is deliberately NOT client-controlled

- **The push text.** `onPokeCreated` generates it from the nudge's `kind` and
  the *sender's profile name as stored on the server*. The `message` field the
  client writes is ignored for the notification. A client that could choose the
  text on a stranger's lock screen would be a harassment channel, not a feature.
- **The daily cap.** The document id is
  `{fromUid}_{toUid}_{kind}_{day}` and the rules permit `create` only, so a
  second nudge of the same kind on the same day collides. A modified client
  cannot spam anybody.
- **Push tokens.** These live on `users/{uid}`, readable only by that user and
  the Admin SDK. Public profiles carry name and handle only. Friend search must
  never become a way to harvest FCM tokens.

### Verifying the rules without a project

The rules are tested against the real emulator and need no credentials:
```
npm run test:rules
```
25 cases, including "one user can never read another's push token" and "the
daily cap holds even when the client tries to bypass it".

### Still device-local

**Groups.** Creating, joining and membership are persisted on the device only.
Group members are fixture people, so the Nudge button inside a group only
appears for members who are also your friends — that is, people with a real
account behind them. Migrating groups is the same shape of work as friends:
a `groups` collection, a `groupCodes/{code}` lookup so joining does not require
listing every group, and membership rules.
