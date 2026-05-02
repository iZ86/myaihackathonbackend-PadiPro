import { Router, Request, Response, raw } from 'express';
import whatsappConverter from './whatsapp-converter';

const router = Router();

router.post(
  '/transcribe',
  raw({ type: 'audio/*', limit: '20mb' }),
  async (req: Request, res: Response) => {
    try {
      const buffer   = req.body as Buffer;
      const mimeType = req.headers['content-type'] ?? '';

      if (!buffer?.length) {
        res.status(400).json({ error: 'Empty body — send raw audio bytes as the request body.' });
        return;
      }

      console.log(`[test-transcribe] size: ${buffer.length} bytes, mime: ${mimeType}`);

      // If it's already mp3, skip conversion
      const transcript = await whatsappConverter.convertAndTranscribe(buffer);

      res.status(200).json({
        transcript,
        mimeType,
        bytes: buffer.length,
      });
    } catch (err) {
      console.error('[test-transcribe] error:', err);
      res.status(500).json({ error: String(err) });
    }
  },
);

export default router;