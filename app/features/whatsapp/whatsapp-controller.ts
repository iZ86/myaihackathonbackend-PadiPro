import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import whatsappService from './whatsapp-service';
import { OTPExpiresAtData, RawWebhookBody } from './whatsapp-model';
import userService from '../user/user-service';
import { UserData } from '../user/user-model';

export class WhatsappController {
  

  async generateOTP(req: Request, res: Response): Promise<void> {

    const { mobile_no } = req.body;

    const result: Result<OTPExpiresAtData> = await whatsappService.generateOTP(mobile_no);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async verifyOTP(req: Request, res: Response): Promise<void> {

    const { mobile_no, otp } = req.body;

    const result: Result<null> = await whatsappService.verifyOTP(mobile_no, otp);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }
}
