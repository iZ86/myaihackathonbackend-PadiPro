import { Request, Response, NextFunction } from "express";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "./status-codes-enum";

/**
 * Extended Response interface
 * Wrapper for easier responses.
 */
declare module 'express-serve-static-core' {

  interface Response {
    sendResponse(statusCode: ENUM_STATUS_CODES_SUCCESS | ENUM_STATUS_CODES_FAILURE, message?: string, data?: any): void
  }
}

/**
 * Middleware to attach response helper methods.
 */
export function enhanceResponse(req: Request, res: Response, next: NextFunction) {
  const r = res as Response;

  r.sendResponse = (statusCode, message?, data?) => {
    if (statusCode in ENUM_STATUS_CODES_SUCCESS) {
      return r.status(statusCode).json({
        success: true, data, message
      });
    } else if (statusCode in ENUM_STATUS_CODES_FAILURE) {
      return r.status(statusCode).json({
        success: false,
        message
      })
    }
    throw new Error("Unknown statusCode in expressEnhancer")
  }

  return next();
}
