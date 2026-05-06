import * as admin from 'firebase-admin';
import { db } from '../../database/db-connection';
import { WhatsappImageData } from './whatsapp-model';
import { ImageOutputDetection } from '../gemini/gemini-model';
import { Timestamp } from 'firebase-admin/firestore';

interface IWhatsappRepository {
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


  private extFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
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

  public async generateAndStoreOTP(mobile_no: string): Promise<string> {
    const docRef = db.collection('OTP').doc(mobile_no);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));

    await docRef.set({
      otp,
      expires_at: expiresAt
    })

    return otp;
  }

  public async verifyOTP(mobileNo: string, inputOtp: string): Promise<boolean> {
    const doc = await db.collection('OTP').doc(mobileNo).get();
    if (!doc.exists) return false;

    const { otp, expires_at } = doc.data()!;

    if (expires_at.toDate() < new Date()) return false;
    if (String(otp) !== String(inputOtp)) return false;

    await db.collection('OTP').doc(mobileNo).delete();
    return true;
  }
}

export default new WhatsappRepository();