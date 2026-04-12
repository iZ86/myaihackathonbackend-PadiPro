// TEMPORARY — delete before prod
import { Request, Response } from 'express';
import { MediaStore } from './whatsapp-service';

// Singleton store — imported by whatsapp-controller.ts AND this file.
// Both share the exact same Map so webhook downloads appear in the dashboard.
export const debugStore = new MediaStore();

export class MediaDebugController {

  listMedia(req: Request, res: Response): void {
    const entries = debugStore.list();

    if (!entries.length) {
      res.send(`
        <p style="font-family:sans-serif;padding:24px">
          No media yet — send an image/audio/video to the bot, then refresh.
        </p>
      `);
      return;
    }

    const rows = entries.map((e) => {
      const url     = `/api/v1/whatsapp/debug/media/${e.mediaId}`;
      const savedAt = new Date(e.savedAt).toLocaleString();
      const isImage = e.mimeType?.startsWith('image/');
      const preview = isImage
        ? `<a href="${url}" target="_blank"><img src="${url}" style="max-height:80px;border-radius:4px;" /></a>`
        : `<span style="color:#888">${e.mimeType ?? 'unknown'}</span>`;

      return `
        <tr>
          <td style="padding:8px">${preview}</td>
          <td style="padding:8px;font-family:monospace;font-size:11px">${e.mediaId}</td>
          <td style="padding:8px">${e.mimeType ?? '—'}</td>
          <td style="padding:8px">${savedAt}</td>
          <td style="padding:8px"><a href="${url}" target="_blank">Open</a></td>
        </tr>`;
    }).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>[DEBUG] WhatsApp Media</title></head>
      <body style="font-family:sans-serif;padding:24px">
        <h2>[DEBUG] Stored media (${entries.length} file${entries.length !== 1 ? 's' : ''})</h2>
        <p style="color:orange;font-size:13px">⚠️ In-memory only — lost on every Render restart.</p>
        <table border="1" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead style="background:#f5f5f5">
            <tr>
              <th style="padding:8px">Preview</th>
              <th style="padding:8px">Media ID</th>
              <th style="padding:8px">MIME type</th>
              <th style="padding:8px">Saved at</th>
              <th style="padding:8px">Link</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `);
  }

  async serveMedia(req: Request<{ mediaId: string }>, res: Response): Promise<void> {
    const { mediaId } = req.params;

    const entry = debugStore.get(mediaId);
    if (!entry) {
      res.status(404).json({ error: 'Not found — store may have reset after a Render restart' });
      return;
    }

    const buffer = await debugStore.read(mediaId);
    if (!buffer) {
      res.status(410).json({ error: 'Index entry exists but file is missing from disk' });
      return;
    }

    res.setHeader('Content-Type',        entry.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Length',      buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${mediaId}"`);
    res.send(buffer);
  }
}