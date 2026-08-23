# Building and signing the Android app

## What "signed debug APK" means

Every Android APK must be signed to install — there is no such thing as an
unsigned installable APK. A **debug** build is signed automatically with the
shared debug keystore at `android/app/debug.keystore` (password `android`,
alias `androiddebugkey`). That keystore ships with the project and is the same
one every RN project uses, so it is fine to commit but **worthless for
distribution**: the Play Store rejects it, and anyone can forge it.

For anything real you need your own **release** keystore. Both are covered below.

---

## Debug APK — command line

```bash
cd android && ./gradlew assembleDebug
```

Output:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a connected device or running emulator:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

To cut build time while iterating, restrict the ABIs to what you actually run
on — this builds native code once instead of four times:

```bash
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=x86_64
```

Use `arm64-v8a` for a physical phone.

> A debug APK expects Metro. To get a standalone APK that runs without a dev
> server, build `assembleRelease` (below) — or `bundleDebug` first if you
> specifically want a self-contained debug build.

---

## Debug APK — Android Studio

1. **File → Open** → select `C:\dev\Kasrat\android` (open the `android` folder,
   **not** the project root — Android Studio needs the Gradle project).
2. Wait for **Gradle sync** to finish. First sync downloads the Android Gradle
   Plugin and dependencies and takes a while.
3. Make sure the build variant is **debug**: **Build → Select Build Variant…**
   → `app` → `debug`.
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. When it finishes, the notification has a **locate** link that opens
   `app/build/outputs/apk/debug/`.

Common first-run problems:

| Symptom | Cause and fix |
| --- | --- |
| `SDK location not found` | Create `android/local.properties` with `sdk.dir=C\:\\Users\\Asus\\AppData\\Local\\Android\\Sdk` |
| `Unsupported class file major version` | Wrong JDK. **File → Settings → Build Tools → Gradle → Gradle JDK** → pick the bundled **JBR 21**. |
| `google-services.json is missing` | It is not — the plugin is skipped when the file is absent (see `android/app/build.gradle`). If you *added* the file and it now fails, the package name inside it is not `com.kasrat`. |
| `minSdkVersion 24 cannot be smaller than 26` | Something reset `minSdkVersion` in `android/build.gradle`; Health Connect needs 26. |
| Build succeeds, app crashes instantly | Usually Metro is not running. `npm start` in the project root. |

---

## Release keystore — do this once

**Generate it:**

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore kasrat-release.keystore -alias kasrat -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and your details. Then:

- Move `kasrat-release.keystore` to `android/app/`.
- **Back it up somewhere safe.** If you lose this file you can never publish an
  update to the same Play listing again — it is not recoverable, by design.
- It is git-ignored. Keep it that way.

**Create `android/keystore.properties`** (also git-ignored):

```properties
storeFile=kasrat-release.keystore
storePassword=YOUR_PASSWORD
keyAlias=kasrat
keyPassword=YOUR_PASSWORD
```

**Wire it into `android/app/build.gradle`** — inside `android { }`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled enableProguardInReleaseBuilds
        proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
}
```

Then:

```bash
cd android && ./gradlew assembleRelease
```

### Android Studio route

**Build → Generate Signed Bundle / APK…** → choose **APK** → **Create new…**
(or select your existing keystore) → fill in the passwords → variant
**release** → Finish. This writes the same output and can create the keystore
for you if you prefer a GUI over `keytool`.

For the Play Store choose **Android App Bundle** instead of APK — Play requires
`.aab` for new apps. Same signing flow.

### Verify a signature

```bash
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```
