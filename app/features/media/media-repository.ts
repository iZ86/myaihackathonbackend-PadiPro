import { db } from '../../database/db-connection';
import { MediaData, LocationTutorialImages } from './media-model';
import { ImageOutputDetection } from '../gemini/gemini-model';

interface IMediaRepository {
  getImagesAndVideosMetaDataByMobileNo(mobile_no: string): Promise<MediaData[]>;
  getMediaMetaDataByMediaName(mediaName: string): Promise<MediaData | undefined>;
  updateImageDiagnosis(mediaName: string, detections: Array<ImageOutputDetection>): Promise<boolean>;
  deleteMediaMetaDataByMediaName(mediaName: string): Promise<boolean>;
  saveMediaMetaData(imageName: string, mobile_no: string, mimeType: string, storagePath: string, downloadUrl: string, caption?: string, sha256?: string): Promise<boolean>;
  getLocationTutorialImages(): Promise<LocationTutorialImages | undefined>;
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

  public async deleteMediaMetaDataByMediaName(mediaName: string): Promise<boolean> {
    try {
      const snapshot = await db.collection(this.collection)
        .where('mediaName', '==', mediaName)
        .limit(1)
        .get();

      if (snapshot.empty) return false;

      const doc = snapshot.docs[0];
      if (!doc) return false;

      await doc.ref.delete();
      return true;
    } catch (error) {
      throw new Error(`deleteMediaByMediaName repository error`, { cause: error });
    }
  }

  public async saveMediaMetaData(mediaName: string, mimeType: string, storagePath: string, downloadUrl: string, mobile_no: string, caption?: string, sha256?: string): Promise<boolean> {
    try {

      //save img data to firestore
      const docRef = db.collection(this.collection).doc();

      const data = {
        from: mobile_no,
        mediaName: mediaName,
        mimeType: mimeType,
        storage_path: storagePath,
        download_url: downloadUrl,
        created_at: new Date().toISOString(),
        caption: caption,
        sha256: sha256,
      };

      await docRef.create(data);

      return true;
    } catch (error) {
      throw new Error(`saveMedia repository error`, { cause: error });
    }
  }

  
  public async getLocationTutorialImages(): Promise<LocationTutorialImages | undefined> {
    try {
      const doc = await db.collection('tutorial').doc('location').get();
      if (!doc.exists) {
        return undefined;
      }
      const { step_1, step_2, step_3 } = doc.data() as LocationTutorialImages;
      return { step_1, step_2, step_3 };
    } catch (error) {
      throw new Error(`getLocationTutorialImages repository error`, { cause: error });
    }
  }
}

export default new MediaRepository();
