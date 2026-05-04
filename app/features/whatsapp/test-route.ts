import { Router, Request, Response, raw } from 'express';
import whatsappRepository from './whatsapp-repository';
import whatsappConverter from './whatsapp-converter';

const router = Router();

router.post(
  '/upload',
  raw({ type: 'image/*', limit: '10mb' }),
  async (req: Request, res: Response) => {
    try {
      const buffer    = req.body as Buffer;
      const mimeType  = req.headers['content-type'] ?? 'image/jpeg';
      const mobile_no = (req.headers['x-mobile-no'] as string) ?? 'test-user';
      const mediaId   = `test-${Date.now()}`;

      if (!buffer?.length) {
        res.status(400).json({ error: 'Empty body — send raw image bytes as the request body.' });
        return;
      }

      console.log(`[test-upload] size: ${buffer.length} bytes, mime: ${mimeType}`);

      const result = await whatsappRepository.saveImage(mobile_no, buffer, { mediaId, mimeType });

      if (!result) {
        res.status(409).json({ error: 'Already exists (duplicate mediaId)' });
        return;
      }

      res.status(200).json({
        message:  'Image saved successfully',
        mediaId:  result,
        mobile_no,
        mimeType,
        hint:     `Check Firebase Storage: whatsapp/${mobile_no}/ and Firestore: whatsapp_images`,
      });
    } catch (err) {
      console.error('[test-upload] error:', err);
      res.status(500).json({ error: String(err) });
    }
  },
);

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