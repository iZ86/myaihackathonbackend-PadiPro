import { Request, Response } from 'express';
import { MessageService } from './whatsapp-service';
import { RawWebhookBody } from './whatsapp-model';
import { debugStore } from './media-controller';

export class WhatsappController {
  private readonly service: MessageService;

  constructor() {
    this.service = new MessageService(debugStore); // pass shared store in
  }

  async handleWebhook(req: Request<{}, {}, RawWebhookBody>, res: Response): Promise<void> {
    try {
      res.sendStatus(200);
      const value = req.body?.entry?.[0]?.changes?.[0]?.value;
      if (!value?.messages?.length) return;
      const rawMsg  = value.messages[0];
      const contact = value.contacts?.[0];
      const meta    = value.metadata;
      const message = this.service.parse(rawMsg!, contact, meta);
      await this.service.handle(message);
    } catch (err) {
      console.error('handleWebhook error:', err);
    }
  }
}