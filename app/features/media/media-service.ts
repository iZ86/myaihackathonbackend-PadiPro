import { Result } from "../../../libs/Result";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { MediaData, MediaFileData } from "./media-model";
import mediaRepository from "./media-repository";
import * as admin from 'firebase-admin';
import crypto from 'crypto';

interface IMediaService {
  getMediaMetaDataByMediaName(mediaName: string): Promise<Result<MediaData>>;
  deleteMediaByMediaName(mediaName: string): Promise<Result<null>>;
  saveImageMetaData(imageName: string, mimeType: string, storagePath: string, downloadUrl: string, mobile_no: string, caption?: string, sha256?: string): Promise<Result<MediaData>>;
  saveImageFile(imageName: string, mimeType: string, buffer: Buffer, mobile_no: string): Promise<Result<MediaFileData>>;
}


class MediaService implements IMediaService {
  private readonly bucket = admin.storage().bucket("gs://myai-hackathon-t1.firebasestorage.app");
  private readonly imageCollection: string = 'images';

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

  private extFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'audio/mpeg': '.mp3'
    };
    return map[mimeType] ?? '';
  }

  public async saveImageMetaData(imageName: string, mimeType: string, storagePath: string, downloadUrl: string, mobile_no: string, caption?: string, sha256?: string): Promise<Result<MediaData>> {
    const saveImageResult: boolean = await mediaRepository.saveMediaMetaData(imageName, mimeType, storagePath, downloadUrl, mobile_no, caption, sha256);
    if (!saveImageResult) {
      throw new Error("saveImageMetaData failed to save image.");
    }

    const savedImage: Result<MediaData> = await this.getMediaMetaDataByMediaName(imageName);
    if (savedImage.isFailure()) {
      throw new Error("savedImageMetaData failed to get saved image.");
    }
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, savedImage.getData(), "Image metadata saved.");
  }

  public async saveImageFile(imageName: string, mimeType: string, buffer: Buffer, mobile_no: string): Promise<Result<MediaFileData>> {
    const ext = this.extFromMime(mimeType);
    if (ext.length === 0 || (ext !== ".jpg" && ext !== ".png" && ext !== ".webp")) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.UNSUPPORTED_MEDIA_TYPE, `File type ${mimeType} not supported for image uploads.`);
    }

    const sha256ImageName: string = crypto.createHash('sha256').update(`${imageName}${mobile_no}${Date.now()}`).digest('hex');
    const storagePath = `${this.imageCollection}/${mobile_no}/${sha256ImageName}${ext}`;
    const file = this.bucket.file(storagePath);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        mobile_no: mobile_no,
      },
    });

    await file.makePublic();
    const download_url = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

    const mediaFileData: MediaFileData = {
      mediaName: sha256ImageName,
      storage_path: storagePath,
      download_url: download_url
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, mediaFileData, "Image file saved.");

  }
}

export default new MediaService();
