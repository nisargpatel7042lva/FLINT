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
