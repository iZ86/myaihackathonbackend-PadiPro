import { Application } from "express";
import userRoute from "../features/user/user-route";
import geminiRoute from "../features/gemini/gemini-route";
import whatsappRoute from "../features/gemini/gemini-route";

export default class Routes {
  constructor(app: Application) {
    app.use("/api/v1/users", userRoute)
    app.use("/api/v1/gemini", geminiRoute)
    app.use("/", whatsappRoute)
  }
}
