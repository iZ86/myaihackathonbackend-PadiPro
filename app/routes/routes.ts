import { Application } from "express";
import userRoute from "../features/user/user-route";
import weatherRoute from "../features/weather/weather-route";
import geminiRoute from "../features/gemini/gemini-route";
import vertexRoute from "../features/vertex/vertex-route";
import whatsappRoute from "../features/whatsapp/whatsapp-route";
import testUploadRoute from "../features/whatsapp/test-route"

export default class Routes {
  constructor(app: Application) {
    app.use("/api/v1/users", userRoute)
    app.use("/api/v1/weather", weatherRoute)
    app.use("/api/v1/gemini", geminiRoute)
    app.use("/api/v1/vertex", vertexRoute);
    app.use("/api/v1/whatsapp", whatsappRoute)
    app.use("/api/v1/test", testUploadRoute)
  }
}
