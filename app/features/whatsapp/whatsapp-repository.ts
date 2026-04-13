import * as admin from 'firebase-admin';
import { db } from '../../database/db-connection';
import { WhatsappImageData } from './whatsapp-model';

interface IWhatsappRepository {
  getImagesByMobileNo(mobile_no: string): Promise<WhatsappImageData[]>;
  getImageByMediaId(media_id: string): Promise<WhatsappImageData | undefined>;
  saveImage(
    mobile_no: string,
    buffer:    Buffer,
    meta: {
      mediaId:  string;
      mimeType: string;
      caption?: string;
      sha256?:  string;
    },
  ): Promise<string | undefined>;
}

class WhatsappRepository implements IWhatsappRepository {
  private readonly bucket     = admin.storage().bucket("gs://myai-hackathon-t1.firebasestorage.app");
  private readonly collection = 'whatsapp_images';

  public async getImagesByMobileNo(mobile_no: string): Promise<WhatsappImageData[]> {
    try {
      const snapshot = await db.collection(this.collection)
        .where('from', '==', mobile_no)
        .get();

      if (snapshot.empty) return [];

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as WhatsappImageData[];
    } catch (error) {
      console.error('Firestore Get Error:', error);
      throw error;
    }
  }

  public async getImageByMediaId(media_id: string): Promise<WhatsappImageData | undefined> {
    try {
      const snapshot = await db.collection(this.collection)
        .where('mediaId', '==', media_id)
        .limit(1)
        .get();

      if (snapshot.empty) return undefined;

      const doc = snapshot.docs[0];
      if (!doc) return undefined;

      return { id: doc.id, ...doc.data() } as unknown as WhatsappImageData;
    } catch (error) {
      console.error('Firestore Get Error:', error);
      throw error;
    }
  }

  public async saveImage(
    mobile_no: string,
    buffer:    Buffer,
    meta: {
      mediaId:  string;
      mimeType: string;
      caption?: string;
      sha256?:  string;
    },
  ): Promise<string | undefined> {
    try {
      // --- 1. Upload buffer to Firebase Storage ---------------
      const ext         = this.extFromMime(meta.mimeType);
      const storagePath = `whatsapp/${mobile_no}/${meta.mediaId}${ext}`;
      const file        = this.bucket.file(storagePath);

      await file.save(buffer, {
        metadata: {
          contentType: meta.mimeType,
          metadata: { mobile_no, media_id: meta.mediaId },
        },
      });

      await file.makePublic();
      const download_url = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

      // --- 2. Save to Firestore — only include defined fields ---
      const docRef = db.collection(this.collection).doc(meta.mediaId);

      const data = {
        from:         mobile_no,
        mediaId:      meta.mediaId,
        mimeType:     meta.mimeType,
        storage_path: storagePath,
        download_url,
        created_at:   new Date().toISOString(),
        ...(meta.caption !== undefined && { caption: meta.caption }),
        ...(meta.sha256  !== undefined && { sha256:  meta.sha256  }),
      };

      await docRef.create(data);

      console.log(`[WhatsappRepository] image saved → ${storagePath}`);
      return meta.mediaId;
    } catch (error: any) {
      if (error.code === 6) {
        console.warn(`[WhatsappRepository] image already exists for mediaId: ${meta.mediaId}`);
        return undefined;
      }
      console.error('Firestore/Storage Save Error:', error);
      throw error;
    }
  }

  private extFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png':  '.png',
      'image/webp': '.webp',
      'image/gif':  '.gif',
    };
    return map[mimeType] ?? '';
  }
}

export default new WhatsappRepository();