import { Request, Response } from 'express';
import { MessageService } from './whatsapp-service';
import { RawWebhookBody } from './whatsapp-model';
import { debugStore } from './media-controller';

export class WhatsappController {
  private readonly service: MessageService;

  constructor() {
    // Pass the shared debugStore so the dashboard and the webhook handler
    // both read from the same Map instance.
    this.service = new MessageService(debugStore);
  }

  async handleWebhook(req: Request<{}, {}, RawWebhookBody>, res: Response): Promise<void> {
    try {
      // Ack immediately — WhatsApp retries if no 200 within 20s
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