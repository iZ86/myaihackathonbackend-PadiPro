
// Needs to run in gcloud workstation and/or deployed in cloudrun to auto authorize
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
