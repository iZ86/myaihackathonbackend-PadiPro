import { Request, Response } from 'express';
import { Result } from "../../../libs/Result";
import whatsappService from './whatsapp-service';
import { RawWebhookBody, WhatsappImageData } from './whatsapp-model';
import userService from '../user/user-service';
import { UserData } from '../user/user-model';

export class WhatsappController {

  async handleWebhook(req: Request<{}, {}, RawWebhookBody>, res: Response): Promise<void> {
    try {
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
          let locationExist: boolean = !(!user.coords);

          await whatsappService.handle(message, userResult.getData(), newUser, locationExist);
        }

      }
    } catch (err) {
      console.error('handleWebhook error:', err);
    }
  }

  async sendMessage(req: Request, res: Response) {
    const mobile_no: string = req.body.mobile_no;
    const name: string = req.body.name;
    const message: string = req.body.message;

    let newUser: boolean = false;
    let userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);
    if (userResult.isFailure()) {
      userResult = await userService.createUser(mobile_no, name);
      newUser = true;
    }

    if (userResult.isSuccess()) {
      //call service logic
      await whatsappService.myHandleText(message, userResult.getData(), newUser);
    }
  }

  async getImagesByMobileNo(req: Request, res: Response) {
    const mobileNo: string = String(req.params.mobile_no);

    const result: Result<WhatsappImageData[]> = await whatsappService.getImagesbyMobileNo(mobileNo);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }

  async sendImage(req: Request, res: Response) {
    const mobile_no: string = req.body.mobile_no;
    const name: string = req.body.name;
    const image_url: string = req.body.image_url;

    let newUser: boolean = false;
    let userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);
    if (userResult.isFailure()) {
      userResult = await userService.createUser(mobile_no, name);
      newUser = true;
    }

    if (userResult.isSuccess()) {
      //call service logic
      await whatsappService.myHandleImage(image_url, userResult.getData(), newUser);
    }
  }
  
}
