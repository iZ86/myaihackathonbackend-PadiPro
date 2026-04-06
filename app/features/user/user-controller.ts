import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import { UserData } from "./user-model";
import userService from "./user-service";

/** Used to handle HTTP requests,
 * Organize data to be sent to service.
 * Controls which service method to use.
 */
export default class UserController {

  async getUsers(req: Request, res: Response) {

    const result: Result<UserData[]> = await userService.getUsers();
    
    return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    
  }

  async getUserById(req: Request, res: Response) {
    const userId: number = Number(req.params.userId);

    const result: Result<UserData> = await userService.getUserById(userId);

    return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
  }
}
