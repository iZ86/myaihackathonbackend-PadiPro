import { db } from '../../database/db-connection';
import { MediaData } from './media-model';
import { ImageOutputDetection } from '../gemini/gemini-model';

interface IMediaRepository {
  getImagesAndVideosMetaDataByMobileNo(mobile_no: string): Promise<MediaData[]>;
  getMediaMetaDataByMediaName(mediaName: string): Promise<MediaData | undefined>;
  updateImageDiagnosis(mediaName: string, detections: Array<ImageOutputDetection>): Promise<boolean>;
}


class MediaRepository implements IMediaRepository {
  private readonly collection: string = 'medias';

  public async getImagesAndVideosMetaDataByMobileNo(mobile_no: string): Promise<MediaData[]> {
    try {
      const snapshot = await db.collection(this.collection)
        .where('from', '==', mobile_no)
        .where('mimeType', 'in', ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
        .get();

      if (snapshot.empty) return [];

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as MediaData[];
    } catch (error) {
      throw new Error(`getMediasByMobileNo repository error`, { cause: error });
    }
  }

  public async getMediaMetaDataByMediaName(mediaName: string): Promise<MediaData | undefined> {
    try {
      const snapshot = await db.collection(this.collection)
        .where('mediaName', '==', mediaName)
        .limit(1)
        .get();

      if (snapshot.empty) return undefined;

      const doc = snapshot.docs[0];
      if (!doc) return undefined;

      return { id: doc.id, ...doc.data() } as unknown as MediaData;
    } catch (error) {
      throw new Error(`getMediaByMediaName repository error`, { cause: error });
    }
  }

  public async updateImageDiagnosis(mediaName: string, detections: Array<ImageOutputDetection>,): Promise<boolean> {
    try {
      const snapshot = await db.collection(this.collection)
        .where('mediaName', '==', mediaName)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.warn(`No record found for media_id: ${mediaName}`);
        return false;
      }

      const doc = snapshot.docs[0];
      if (!doc) return false;

      await doc.ref.update({
        detections: detections,
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      throw new Error(`updateImageDiagnosis repository error`, { cause: error });
    }
  }
}

export default new MediaRepository();
