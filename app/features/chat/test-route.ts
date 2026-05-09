import { Router, Request, Response } from 'express';

const router = Router();

router.post('/send-media', async (req: Request, res: Response) => {
  try {
    const { mobile_no, type, message, base64URL, mediaType } = req.body;

    if (!mobile_no || !type || !base64URL || !mediaType) {
      res.status(400).json({ error: 'Missing required fields: mobile_no, type, base64URL, mediaType' });
      return;
    }

    // Dynamically import your service — adjust path as needed
    const { WhatsappService } = await import('../whatsapp/whatsapp-service');
    const service = new (WhatsappService as any)();

    await service.sendMedia(mobile_no, type, message ?? '', base64URL, mediaType);

    res.status(200).json({ message: 'sendMedia completed successfully' });
  } catch (err) {
    console.error('[test-send-media] error:', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;