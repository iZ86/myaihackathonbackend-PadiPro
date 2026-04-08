require('dotenv').config();

/** This is where you would put your dotenv variables.
 * Every file will reference this area for your dotenv variables if needed.
 */
export const database = {
  host: process.env.databaseHost,
  user: process.env.databaseUser,
  password: process.env.databasePassword,
  database: process.env.database,
  timezone: process.env.timeZone
};

export const someServiceConfig = {
  someServiceToken: process.env.someServiceToken
};

export const geminiServiceConfig = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string
};