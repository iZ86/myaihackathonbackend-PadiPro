// ============================================================
// controllers/whatsapp.controller.ts
// ============================================================

import { Request, Response } from 'express';
import { MessageService } from './whatsapp-service';
import { RawWebhookBody } from './whatsapp-model';

export class WhatsappController {
  private readonly service: MessageService;

  constructor() {
    this.service = new MessageService();
  }

  async handleWebhook(req: Request<{}, {}, RawWebhookBody>, res: Response): Promise<void> {
    try {
      // Ack immediately — WhatsApp retries if no 200 within 20s
      res.sendStatus(200);

      const value = req.body?.entry?.[0]?.changes?.[0]?.value;
      if (!value?.messages?.length) return; // status update or empty ping

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