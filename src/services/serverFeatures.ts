/**
 * Features that need Cloud Functions, which need Firebase's paid (Blaze) plan.
 *
 * The beta runs on the free plan, so these stay hidden rather than failing on
 * tap. The functions are written (functions/src/index.ts); flip this to true
 * after `firebase deploy --only functions` succeeds.
 */
export const CLOUD_FUNCTIONS = false;
