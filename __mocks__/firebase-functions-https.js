/**
 * Stand-in for `firebase-functions/v2/https`, so the security helpers in
 * `functions/src/secure.ts` can be unit-tested from the app's own Jest run.
 *
 * Installing a second test toolchain inside functions/ just to reach a pure
 * module would be a lot of machinery for one file — and this is the file most
 * worth testing, because a weak token generator produces output that looks
 * exactly like a strong one.
 */
class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

module.exports = { HttpsError };
