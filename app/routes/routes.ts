import { Application } from "express";
import userRouters from "../features/user/user-routers";
import geminiRouters from "../features/gemini/gemini-routers";

export default class Routes {
  constructor(app: Application) {
    app.use("/api/v1/users", userRouters)
    app.use("/api/v1/gemini", geminiRouters)
  }
}
