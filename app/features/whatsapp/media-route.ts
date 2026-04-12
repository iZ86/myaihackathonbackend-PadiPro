// ============================================================
// debug/media-debug.route.ts
// TEMPORARY — delete this file before prod
// ============================================================

import { Router, Request, Response } from 'express';
import { MediaDebugController } from './media-controller';

const router = Router();
const ctrl   = new MediaDebugController();

// GET /api/v1/whatsapp/debug/media
router.get('/media', (req: Request, res: Response) => ctrl.listMedia(req, res));

// GET /api/v1/whatsapp/debug/media/:mediaId
router.get('/media/:mediaId', (req: Request<{ mediaId: string }>, res: Response) =>
  ctrl.serveMedia(req, res),
);

export default router;