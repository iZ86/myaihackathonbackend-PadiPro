require('dotenv').config();

export const serverConfig = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
  FRONTEND_URL: process.env.FRONTEND_URL as string
}

export const geminiServiceConfig = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string
};

export const weatherServiceConfig = {
  WEATHER_API_KEY: process.env.WEATHER_API_KEY as string
};

export const vertexServiceConfig = {
  VERTEX_PROJECT_ID: process.env.VERTEX_PROJECT_ID as string,
  VERTEX_LOCATION: process.env.VERTEX_LOCATION as string,
  VERTEX_COLLECTION: process.env.VERTEX_COLLECTION as string,
  VERTEX_ENGINE_ID: process.env.VERTEX_ENGINE_ID as string,
  VERTEX_SERVING_CONFIG: process.env.VERTEX_SERVING_CONFIG as string,
  VERTEX_PROMPT_SEC: process.env.VERTEX_PROMPT_SEC as string,
  VERTEX_MODEL_VERSION: process.env.VERTEX_MODEL_VERSION as string
}

export const speechConfig = {
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT as string
};

export const testConfig = {
  TEST: process.env.TEST as string
}
