import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import { UserData } from "./user-model";
import userService from "./user-service";
import { MediaData } from "../media/media-model";

export default class UserController {

  async getUsers(req: Request, res: Response) {

    const result: Result<UserData[]> = await userService.getUsers();

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }

  }

  async getUserByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);

    const result: Result<UserData> = await userService.getUserByMobileNo(mobileNo);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async createUser(req: Request, res: Response) {
    const mobileNo: string = req.body.mobile_no;
    const name: string = req.body.name;

    const result: Result<UserData> = await userService.createUser(mobileNo, name);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async updateUserNameByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);
    const name: string = req.body.name;

    const result: Result<UserData> = await userService.updateUserNameByMobileNo(mobileNo, name);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async updateUserCoordsByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);
    const lat: number = req.body.lat;
    const long: number = req.body.long;

    const result: Result<UserData> = await userService.updateUserCoordsByMobileNo(lat, long, mobileNo);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async updateUserLangByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);
    const lang: string = req.body.lang;
    const type: string = req.body.type;

    const result: Result<UserData> = await userService.updateUserLangByMobileNo(lang, mobileNo, type);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async getDiagnosisHistoryByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);

    const result: Result<MediaData[]> = await userService.getDiagnosisHistoryByMobileNo(mobileNo);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }
}
