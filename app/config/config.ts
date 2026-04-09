require('dotenv').config();

export const serverConfig = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080
}

export const geminiServiceConfig = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string
};

export const weatherServiceConfig = {
  WEATHER_API_KEY: process.env.WEATHER_API_KEY as string
};