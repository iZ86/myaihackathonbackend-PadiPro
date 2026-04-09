import express, { Application, NextFunction, Request, Response } from "express";
import cors, { CorsOptions } from "cors";
import Routes from "./routes/routes";
import { enhanceResponse } from "../libs/express-enhancer";
import { ENUM_STATUS_CODES_FAILURE } from "../libs/status-codes-enum";

export default class Server {
  constructor(app: Application) {
    this.config(app);
    new Routes(app);


    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error("Error details: " + error);
      res.sendResponse(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "An internal error occured.");
      return;
    })
  }

  private config(app: Application): void {
    const corsOptions: CorsOptions = {
      origin: "http://localhost:5173"
    };
    app.use(cors(corsOptions));


    app.use(enhanceResponse);
    app.use(express.json());
    // Middleware to prevent invalid JSON format from crashing the server.
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof SyntaxError) {
        console.error("Invalid JSON Format Error Middleware: " + err);
        res.sendResponse(ENUM_STATUS_CODES_FAILURE.BAD_REQUEST, "Invalid JSON format.");
        return;
      }
      next();
    });

    app.use(express.urlencoded({ extended: true }));
  }
}
