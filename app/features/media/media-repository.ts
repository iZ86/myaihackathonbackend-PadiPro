import { db } from '../../database/db-connection';
import { MediaData } from './media-model';

interface IMediaRepository {
  getImagesAndVideosMetaDataByMobileNo(mobile_no: string): Promise<MediaData[]>;
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
}

export default new MediaRepository();
