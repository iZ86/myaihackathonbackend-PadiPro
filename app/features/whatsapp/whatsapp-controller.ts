import { Request, Response } from 'express';
import { Result } from "../../../libs/Result";
import whatsappService from './whatsapp-service';
import { RawWebhookBody } from './whatsapp-model';
import userService from '../user/user-service';
import { UserData } from '../user/user-model';
import userRepository from '../user/user-repository';

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
      if(contact?.wa_id){
        const userResult: Result<UserData> = await userService.getUserByMobileNo(contact?.wa_id);
        (userResult.isFailure())? userRepository.createUser(contact.wa_id, contact.profile.name) : ""
      }


      await whatsappService.handle(message);
    } catch (err) {
      console.error('handleWebhook error:', err);
    }
  }
}