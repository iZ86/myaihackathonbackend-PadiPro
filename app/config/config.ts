require('dotenv').config();

/** This is where you would put your dotenv variables.
 * Every file will reference this area for your dotenv variables if needed.
 */
export const database = {
  HOST: process.env.DATABASE,
  USER: process.env.DATABASEUSER,
  PASSWORD: process.env.DATABASEPASSWORD,
  DATABASE: process.env.DATABASE,
  TIMEZONE: process.env.TIMEZONE
};

export const serverConfig = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080
}

export const someServiceConfig = {
  SOMESERVICETOKEN: process.env.SOMESERVICETOKEN
};

export const geminiServiceConfig = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string
};