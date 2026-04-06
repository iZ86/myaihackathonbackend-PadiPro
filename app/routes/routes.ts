import { Application } from "express";
import userRouters from "../features/user/user-routers";

export default class Routes {
  constructor(app: Application) {
    app.use("/api/v1/users", userRouters)
  }
}
