import { NextFunction } from "express";
import { Request, Response } from "express";
import { ENUM_STATUS_CODES_FAILURE } from "../../libs/status-codes-enum";

/** Checks if there is an auth header and token. 
 * Currently this is just for testing, 
 * it just makes sure theres is ANY string that is in the authorization header.
*/
export const checkAuthTokenHeader = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.setHeader('WWW-Authentiate', 'Bearer realm="test"');
    return res.sendResponse(ENUM_STATUS_CODES_FAILURE.UNAUTHORIZED, "Invalid credentials");
  }
  return next();
};
