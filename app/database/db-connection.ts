/** Example of db-connection and using dotenv variables.
 */

// import mysql from 'mysql2';
// import { database } from "../config/config";

// export default mysql.createConnection({
//   host: database.host,
//   user: database.user,
//   password: database.password,
//   database: database.database,
//   timezone: database.timezone
// });

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
