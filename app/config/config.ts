require("dotenv").config();

export const serverConfig = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
  FRONTEND_URL: process.env.FRONTEND_URL as string,
};

export const firestoreConfig = {
  DEV_MODE: process.env.FIRESTORE_DEV_MODE ?? "PROD",
  EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST as string,
  PROJECT_ID: process.env.FIRESTORE_PROJECT_ID as string,
};

export const geminiServiceConfig = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
};

export const weatherServiceConfig = {
  WEATHER_API_KEY: process.env.WEATHER_API_KEY as string,
};

export const vertexServiceConfig = {
  VERTEX_PROJECT_ID: process.env.VERTEX_PROJECT_ID as string,
  VERTEX_LOCATION: process.env.VERTEX_LOCATION as string,
  VERTEX_COLLECTION: process.env.VERTEX_COLLECTION as string,
  VERTEX_ENGINE_ID: process.env.VERTEX_ENGINE_ID as string,
  VERTEX_SERVING_CONFIG: process.env.VERTEX_SERVING_CONFIG as string,
  VERTEX_PROMPT_SEC: process.env.VERTEX_PROMPT_SEC as string,
  VERTEX_MODEL_VERSION: process.env.VERTEX_MODEL_VERSION as string,
};

export const speechConfig = {
  SPEECH_PROJECT: process.env.SPEECH_PROJECT as string,
  API_ENDPOINT: process.env.SPEECH_API_ENDPOINT as string,
  REGION: process.env.SPEECH_REGION as string,
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT as string,
};

export const firebaseConfig = {
  BUCKET: process.env.FIREBASE_STORAGE_BUCKET as string,
};

export const whatsappConfig = {
  VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN as string,
  API_VERSION: process.env.WHATSAPP_API_VERSION as string,
  API_KEY: process.env.WHATSAPP_API_KEY as string,
  PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID as string
}

export const translateServiceConfig = {
  PROJECT_ID: process.env.TRANSLATE_PROJECT_ID as string
}