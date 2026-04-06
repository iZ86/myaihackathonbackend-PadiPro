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
}

export const someService = {
  someServiceToken: process.env.someServiceToken
}
