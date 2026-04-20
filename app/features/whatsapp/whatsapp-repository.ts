import * as admin from 'firebase-admin';
import { db } from '../../database/db-connection';
import { WhatsappImageData } from './whatsapp-model';

interface IWhatsappRepository {
  getImagesByMobileNo(mobile_no: string): Promise<WhatsappImageData[]>;
  getImageByMediaId(media_id: string): Promise<WhatsappImageData | undefined>;
  saveImage(
    mobile_no: string,
    buffer: Buffer,
    meta: {
      mediaId: string;
      mimeType: string;
      caption?: string;
      sha256?: string;
    },
  ): Promise<boolean>;
  deleteImageByMediaId(media_id: string): Promise<boolean>;
}

interface LocationTutorialImages {
  step_1: string;
  step_2: string;
  step_3: string;
}

class WhatsappRepository implements IWhatsappRepository {
  private readonly bucket = admin.storage().bucket("gs://myai-hackathon-t1.firebasestorage.app");
  private readonly collection = 'images';

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

  //also for future
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

  public async deleteImageByMediaId(media_id: string): Promise<boolean> {
    try {
      const snapshot = await db.collection(this.collection)
        .where('mediaId', '==', media_id)
        .limit(1)
        .get();

      if (snapshot.empty) return false;

      const doc = snapshot.docs[0];
      if (!doc) return false;

      const data = doc.data();

      // 1. Delete from Storage bucket
      if (data.storage_path) {
        const file = this.bucket.file(data.storage_path);
        await file.delete();
      }

      // 2. Delete from Firestore
      await doc.ref.delete();
      return true;
    } catch (error) {
      console.error('Delete Error:', error);
      throw error;
    }
  }

  public async saveImage(
    mobile_no: string,
    buffer: Buffer,
    meta: {
      mediaId: string;
      mimeType: string;
      caption?: string;
      sha256?: string;
    },
  ): Promise<boolean> {
    try {
      //upload img to firebase storage
      const ext = this.extFromMime(meta.mimeType);
      const storagePath = `images/${mobile_no}/${meta.mediaId}${ext}`;
      const file = this.bucket.file(storagePath);

      await file.save(buffer, {
        metadata: {
          contentType: meta.mimeType,
          metadata: { mobile_no, media_id: meta.mediaId },
        },
      });

      await file.makePublic();
      const download_url = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

      //save img data to firestore
      const docRef = db.collection(this.collection).doc();

      const data = {
        from: mobile_no,
        mediaId: meta.mediaId,
        mimeType: meta.mimeType,
        storage_path: storagePath,
        download_url,
        created_at: new Date().toISOString(),
        ...(meta.caption !== undefined && { caption: meta.caption }),
        ...(meta.sha256 !== undefined && { sha256: meta.sha256 }),
      };

      await docRef.create(data);

      console.log(`[WhatsappRepository] image saved → ${storagePath}`);
      return true;
    } catch (error: any) {
      if (error.code === 6) {
        console.warn(`[WhatsappRepository] image already exists for mediaId: ${meta.mediaId}`);
        return false;
      }
      console.error('Firestore/Storage Save Error:', error);
      throw error;
    }
  }

  private extFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return map[mimeType] ?? '';
  }

  public async getLocationTutorialImages(): Promise<LocationTutorialImages | undefined> {
    try {
      const doc = await db.collection('tutorial').doc('location').get();
      if (!doc.exists) {
        console.warn('[WhatsappRepository] tutorial/location document not found');
        return undefined;
      }
      const { step_1, step_2, step_3 } = doc.data() as LocationTutorialImages;
      return { step_1, step_2, step_3 };
    } catch (error) {
      console.error('getLocationTutorialImages error:', error);
      throw error;
    }
  }
}

export default new WhatsappRepository();