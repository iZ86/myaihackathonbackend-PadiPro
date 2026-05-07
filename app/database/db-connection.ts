
  // Needs to run in gcloud workstation and/or deployed in cloudrun to auto authorize
  import * as admin from 'firebase-admin';
  import { firestoreConfig } from "../config/config";

  if (!admin.apps.length) {
    const options: admin.AppOptions = {};
    if (firestoreConfig.DEV_MODE !== 'PROD') {
      options.projectId = firestoreConfig.PROJECT_ID;
    }

    admin.initializeApp(options);
  }

  export const db = admin.firestore();