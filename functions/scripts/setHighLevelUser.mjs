/**
 * Bootstrap script: set highLevel custom claim for a user.
 *
 * Usage:
 *   node scripts/setHighLevelUser.mjs <uid> [serviceAccountKey.json]
 *
 * Credentials (pick one):
 *   1. Pass path to service account JSON as second arg (recommended)
 *   2. Set env: GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
 *
 * To get a service account key:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   Save the JSON file and add it to .gitignore (e.g. functions/serviceAccountKey.json)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = 'acptributeboard';
const uid = process.argv[2];
const keyPath = process.argv[3];

if (!uid) {
    console.error('Usage: node scripts/setHighLevelUser.mjs <uid> [serviceAccountKey.json]');
    console.error('');
    console.error('Credentials: Pass a service account JSON path, or set GOOGLE_APPLICATION_CREDENTIALS');
    process.exit(1);
}

let appOptions = { projectId };
if (keyPath) {
    const keyPathResolved = resolve(process.cwd(), keyPath);
    const key = JSON.parse(readFileSync(keyPathResolved, 'utf8'));
    appOptions = { credential: cert(key), projectId };
}

initializeApp(appOptions);

async function main() {
    await getAuth().setCustomUserClaims(uid, { highLevel: true });
    console.log(`Set highLevel: true for uid ${uid}. User may need to sign out/in to see changes.`);
}

main().catch((err) => {
    if (err.code === 'app/invalid-credential') {
        console.error('Credential error. Options:');
        console.error('  1. Pass service account path: node scripts/setHighLevelUser.mjs <uid> path/to/key.json');
        console.error('  2. Set GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json');
        console.error('');
        console.error('Get a key: Firebase Console → Project Settings → Service Accounts → Generate new private key');
    } else {
        console.error(err);
    }
    process.exit(1);
});
