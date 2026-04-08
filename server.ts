import express, { Application } from "express";
import Server from "./app/index";
import { serverConfig } from "./app/config/config";

const app: Application = express();
const server: Server = new Server(app);
const PORT: number = serverConfig.PORT;
app
  .listen(PORT, function () {
    console.log(`Server is running on port ${PORT}.`);
  })
  .on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.log("Error: address already in use");
    } else {
      console.log(err);
    }
  });