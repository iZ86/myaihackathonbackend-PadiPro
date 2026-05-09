import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import whatsappService from './whatsapp-service';
import { OTPExpiresAtData, RawWebhookBody } from './whatsapp-model';
import userService from '../user/user-service';
import { UserData } from '../user/user-model';

export class WhatsappController {
  async handleWebhook(req: Request<{}, {}, RawWebhookBody>, res: Response): Promise<void> {
    // Act immediately — WhatsApp retries if no 200 within 20s
    res.sendStatus(200);

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages?.length) return; // status update or empty ping

    const rawMsg = value.messages[0];
    const contact = value.contacts?.[0];
    const meta = value.metadata;

    const message = whatsappService.parse(rawMsg!, contact, meta);

    //check if user exist
    if (contact && contact.wa_id) {
      const mobile_no: string = contact.wa_id;

      let newUser: boolean = false;
      let userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

      if (userResult.isFailure()) {
        userResult = await userService.createUser(contact.wa_id, contact.profile.name);
        newUser = true;
      }

      if (userResult.isSuccess()) {
        //call service logic

        const user: UserData = userResult.getData();
        let locationExist: boolean = !!user.coords;

        await whatsappService.handle(message, userResult.getData(), newUser, locationExist);
      }
    }
  }

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
