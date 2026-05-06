import { Result } from "../../../libs/Result";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { MediaData } from "./media-model";
import mediaRepository from "./media-repository";
import * as admin from 'firebase-admin';

interface IMediaService {
  getMediaMetaDataByMediaName(mediaName: string): Promise<Result<MediaData>>;
  deleteMediaByMediaName(mediaName: string): Promise<Result<null>>;

}


class MediaService implements IMediaService {
  private readonly bucket = admin.storage().bucket("gs://myai-hackathon-t1.firebasestorage.app");

  public async getMediaMetaDataByMediaName(mediaName: string): Promise<Result<MediaData>> {
    const media: MediaData | undefined = await mediaRepository.getMediaMetaDataByMediaName(mediaName);
    if (!media) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "Media meta data not found.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, media, "Media meta data found.");
  }

  public async deleteMediaByMediaName(mediaName: string): Promise<Result<null>> {

    const mediaResult: Result<MediaData> = await this.getMediaMetaDataByMediaName(mediaName);
    if (mediaResult.isFailure()) {
      return mediaResult;
    }

    const media: MediaData = mediaResult.getData();

    const storagePath: string = media.storage_path;

    const deleteMediaFileResult: Result<null> = await this.deleteMediaFileByStoragePath(storagePath);

    if (deleteMediaFileResult.isFailure()) {
      return deleteMediaFileResult;
    }

    await this.deleteMediaMetaDataByMediaName(mediaName);

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.NO_CONTENT, null, "Media successfully deleted.");
  }

  private async deleteMediaMetaDataByMediaName(mediaName: string): Promise<Result<null>> {

    const deleteResult: boolean = await mediaRepository.deleteMediaMetaDataByMediaName(mediaName);
    if (!deleteResult) {
      throw new Error("deleteMediaByMediaName failed to delete.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.NO_CONTENT, null, "Media meta data successfully deleted.");
  }

  private async deleteMediaFileByStoragePath(storagePath: string): Promise<Result<null>> {
    const file = this.bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "Media file not found.");
    }
    await file.delete();
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.NO_CONTENT, null, "Media file successfully deleted.");
  }
}

export default new MediaService();
