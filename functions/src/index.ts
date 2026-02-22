/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

setGlobalOptions({ maxInstances: 10 });

/**
 * Callable function: assign highLevel custom claim to a user.
 * Only existing high-level users can invoke this.
 */
export const assignHighLevel = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
    }
    if (!request.auth.token.highLevel) {
        throw new HttpsError(
            "permission-denied",
            "Only high-level users can assign this role"
        );
    }
    const targetUid = request.data?.uid;
    if (!targetUid || typeof targetUid !== "string") {
        throw new HttpsError("invalid-argument", "uid is required");
    }
    await getAuth().setCustomUserClaims(targetUid, { highLevel: true });
    return { success: true };
});
