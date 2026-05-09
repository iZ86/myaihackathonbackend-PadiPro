import { Result } from "../../../libs/Result";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { LocationTutorialImages, MediaData, MediaFileData } from "./media-model";
import mediaRepository from "./media-repository";
import * as admin from "firebase-admin";
import crypto from "crypto";
import { MediaOutputDetection } from "../gemini/gemini-model";
import userService from "../user/user-service";
import { UserData } from "../user/user-model";
import { firebaseConfig } from "../../config/config";

interface IMediaService {
  getMediaMetaDataByMediaName(mediaName: string): Promise<Result<MediaData>>;
  deleteMediaByMediaName(mediaName: string): Promise<Result<null>>;
  saveImage(
    imageName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>>;
  saveImageMetaData(
    imageName: string,
    mimeType: string,
    storagePath: string,
    downloadUrl: string,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>>;
  saveImageFile(imageName: string, mimeType: string, buffer: Buffer, mobile_no: string): Promise<Result<MediaFileData>>;
  saveVideo(
    videoName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>>;
  saveVideoMetaData(
    videoName: string,
    mimeType: string,
    storagePath: string,
    downloadUrl: string,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>>;
  saveVideoFile(videoName: string, mimeType: string, buffer: Buffer, mobile_no: string): Promise<Result<MediaFileData>>;
  saveAudio(
    audioName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>>;
  saveAudioMetaData(
    audioName: string,
    mimeType: string,
    storagePath: string,
    downloadUrl: string,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>>;
  saveAudioFile(audioName: string, mimeType: string, buffer: Buffer, mobile_no: string): Promise<Result<MediaFileData>>;
  saveDocument(
    docName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>>;
  saveDocumentMetaData(
    docName: string,
    mimeType: string,
    storagePath: string,
    downloadUrl: string,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>>;
  saveDocumentFile(
    docName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
  ): Promise<Result<MediaFileData>>;
  updateImageOrVideoDiagnosis(mediaName: string, detections: Array<MediaOutputDetection>): Promise<Result<MediaData>>;
  getLocationTutorialImages(): Promise<Result<LocationTutorialImages>>;
  getImagesAndVideosMetaDataByMobileNo(mobile_no: string): Promise<Result<MediaData[]>>;
}

class MediaService implements IMediaService {
  private readonly bucket = admin.storage().bucket(firebaseConfig.BUCKET);
  private readonly imageCollection: string = "images";
  private readonly videoCollection: string = "videos";
  private readonly audioCollection: string = "audios";
  private readonly docCollection: string = "documents";

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
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "video/mp4": ".mp4",
      "audio/mpeg": ".mp3",
      "audio/ogg": ".ogg",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    };
    return map[mimeType] ?? "";
  }

  public async saveImage(
    imageName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>> {
    const imageFileResult: Result<MediaFileData> = await this.saveImageFile(imageName, mimeType, buffer, mobile_no);
    if (imageFileResult.isFailure()) {
      return imageFileResult;
    }

    const imageFile: MediaFileData = imageFileResult.getData();

    try {
      await this.saveImageMetaData(
        imageFile.mediaName,
        mimeType,
        imageFile.storage_path,
        imageFile.download_url,
        mobile_no,
        caption,
        sha256,
      );
    } catch (error) {
      this.deleteMediaByMediaName(imageFile.mediaName);
      throw new Error("saveImage failed to save", { cause: error });
    }

    const imageData: Result<MediaData> = await this.getMediaMetaDataByMediaName(imageFile.mediaName);
    if (imageData.isFailure()) {
      throw new Error("saveImage failed to get saved image.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, imageData.getData(), "Image saved.");
  }

  public async saveImageMetaData(
    imageName: string,
    mimeType: string,
    storagePath: string,
    downloadUrl: string,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>> {
    const saveImageResult: boolean = await mediaRepository.saveMediaMetaData(
      imageName,
      mimeType,
      storagePath,
      downloadUrl,
      mobile_no,
      caption ?? "",
      sha256 ?? "",
    );
    if (!saveImageResult) {
      throw new Error("saveImageMetaData failed to save image.");
    }

    const savedImage: Result<MediaData> = await this.getMediaMetaDataByMediaName(imageName);
    if (savedImage.isFailure()) {
      throw new Error("savedImageMetaData failed to get saved image.");
    }
    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, savedImage.getData(), "Image metadata saved.");
  }

  public async saveImageFile(
    imageName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
  ): Promise<Result<MediaFileData>> {
    const ext = this.extFromMime(mimeType);
    if (ext.length === 0 || (ext !== ".jpg" && ext !== ".png" && ext !== ".webp")) {
      return Result.fail(
        ENUM_STATUS_CODES_FAILURE.UNSUPPORTED_MEDIA_TYPE,
        `File type ${mimeType} not supported for image uploads.`,
      );
    }

    const sha256ImageName: string = crypto
      .createHash("sha256")
      .update(`${imageName}${mobile_no}${Date.now()}`)
      .digest("hex");
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
      download_url: download_url,
    };

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, mediaFileData, "Image file saved.");
  }

  public async saveVideo(
    videoName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>> {
    const videoFileResult: Result<MediaFileData> = await this.saveVideoFile(videoName, mimeType, buffer, mobile_no);
    if (videoFileResult.isFailure()) {
      return videoFileResult;
    }

    const videoFile: MediaFileData = videoFileResult.getData();

    try {
      this.saveVideoMetaData(
        videoFile.mediaName,
        mimeType,
        videoFile.storage_path,
        videoFile.download_url,
        mobile_no,
        caption,
        sha256,
      );
    } catch (error) {
      this.deleteMediaByMediaName(videoFile.mediaName);
      throw new Error("saveVideo failed to save", { cause: error });
    }

    const videoData: Result<MediaData> = await this.getMediaMetaDataByMediaName(videoFile.mediaName);
    if (videoData.isFailure()) {
      throw new Error("saveVideo failed to get saved video.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, videoData.getData(), "Video saved.");
  }

  public async saveVideoMetaData(
    videoName: string,
    mimeType: string,
    storagePath: string,
    downloadUrl: string,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>> {
    const saveVideoResult: boolean = await mediaRepository.saveMediaMetaData(
      videoName,
      mimeType,
      storagePath,
      downloadUrl,
      mobile_no,
      caption ?? "",
      sha256 ?? "",
    );
    if (!saveVideoResult) {
      throw new Error("saveVideoMetaData failed to save video.");
    }

    const savedVideo: Result<MediaData> = await this.getMediaMetaDataByMediaName(videoName);
    if (savedVideo.isFailure()) {
      throw new Error("savedVideoMetaData failed to get saved video.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, savedVideo.getData(), "Video metadata saved.");
  }

  public async saveVideoFile(
    videoName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
  ): Promise<Result<MediaFileData>> {
    const ext = this.extFromMime(mimeType);
    if (ext.length === 0 || ext !== ".mp4") {
      return Result.fail(
        ENUM_STATUS_CODES_FAILURE.UNSUPPORTED_MEDIA_TYPE,
        `File type ${mimeType} not supported for video uploads.`,
      );
    }

    const sha256VideoName: string = crypto
      .createHash("sha256")
      .update(`${videoName}${mobile_no}${Date.now()}`)
      .digest("hex");
    const storagePath = `${this.videoCollection}/${mobile_no}/${sha256VideoName}${ext}`;
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
      mediaName: sha256VideoName,
      storage_path: storagePath,
      download_url: download_url,
    };

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, mediaFileData, "Video file saved.");
  }

  public async saveAudio(
    audioName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>> {
    const audioFileResult: Result<MediaFileData> = await this.saveAudioFile(audioName, mimeType, buffer, mobile_no);
    if (audioFileResult.isFailure()) {
      return audioFileResult;
    }

    const audioFile: MediaFileData = audioFileResult.getData();

    try {
      this.saveAudioMetaData(
        audioFile.mediaName,
        mimeType,
        audioFile.storage_path,
        audioFile.download_url,
        mobile_no,
        caption,
        sha256,
      );
    } catch (error) {
      this.deleteMediaByMediaName(audioFile.mediaName);
      throw new Error("saveAudio failed to save", { cause: error });
    }

    const audioData: Result<MediaData> = await this.getMediaMetaDataByMediaName(audioFile.mediaName);
    if (audioData.isFailure()) {
      throw new Error("saveAudio failed to get saved audio.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, audioData.getData(), "Audio saved.");
  }

  public async saveAudioMetaData(
    audioName: string,
    mimeType: string,
    storagePath: string,
    downloadUrl: string,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>> {
    const saveAudioResult: boolean = await mediaRepository.saveMediaMetaData(
      audioName,
      mimeType,
      storagePath,
      downloadUrl,
      mobile_no,
      caption ?? "",
      sha256 ?? "",
    );
    if (!saveAudioResult) {
      throw new Error("saveAudio failed to save audio.");
    }

    const savedAudio: Result<MediaData> = await this.getMediaMetaDataByMediaName(audioName);
    if (savedAudio.isFailure()) {
      throw new Error("savedAudioMetaData failed to get saved audio.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, savedAudio.getData(), "Audio metadata saved.");
  }

  public async saveAudioFile(
    audioName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
  ): Promise<Result<MediaFileData>> {
    const ext = this.extFromMime(mimeType);
    if (ext.length === 0 || (ext !== ".mp3" && ext !== ".ogg") ) {
      return Result.fail(
        ENUM_STATUS_CODES_FAILURE.UNSUPPORTED_MEDIA_TYPE,
        `File type ${mimeType} not supported for audio uploads.`,
      );
    }

    const sha256AudioName: string = crypto
      .createHash("sha256")
      .update(`${audioName}${mobile_no}${Date.now()}`)
      .digest("hex");
    const storagePath = `${this.audioCollection}/${mobile_no}/${sha256AudioName}${ext}`;
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
      mediaName: sha256AudioName,
      storage_path: storagePath,
      download_url: download_url,
    };

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, mediaFileData, "Audio file saved.");
  }

  public async saveDocument(
    docName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>> {
    const audioFileResult: Result<MediaFileData> = await this.saveDocumentFile(docName, mimeType, buffer, mobile_no);
    if (audioFileResult.isFailure()) {
      return audioFileResult;
    }

    const audioFile: MediaFileData = audioFileResult.getData();

    try {
      this.saveAudioMetaData(
        audioFile.mediaName,
        mimeType,
        audioFile.storage_path,
        audioFile.download_url,
        mobile_no,
        caption,
        sha256,
      );
    } catch (error) {
      this.deleteMediaByMediaName(audioFile.mediaName);
      throw new Error("saveAudio failed to save", { cause: error });
    }

    const audioData: Result<MediaData> = await this.getMediaMetaDataByMediaName(audioFile.mediaName);
    if (audioData.isFailure()) {
      throw new Error("saveAudio failed to get saved audio.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, audioData.getData(), "Audio saved.");
  }

  public async saveDocumentMetaData(
    docName: string,
    mimeType: string,
    storagePath: string,
    downloadUrl: string,
    mobile_no: string,
    caption?: string,
    sha256?: string,
  ): Promise<Result<MediaData>> {
    const saveAudioResult: boolean = await mediaRepository.saveMediaMetaData(
      docName,
      mimeType,
      storagePath,
      downloadUrl,
      mobile_no,
      caption ?? "",
      sha256 ?? "",
    );
    if (!saveAudioResult) {
      throw new Error("saveAudio failed to save audio.");
    }

    const savedAudio: Result<MediaData> = await this.getMediaMetaDataByMediaName(docName);
    if (savedAudio.isFailure()) {
      throw new Error("savedAudioMetaData failed to get saved audio.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, savedAudio.getData(), "Audio metadata saved.");
  }

  public async saveDocumentFile(
    docName: string,
    mimeType: string,
    buffer: Buffer,
    mobile_no: string,
  ): Promise<Result<MediaFileData>> {
    const ext = this.extFromMime(mimeType);
    const sha256DocName: string = crypto
      .createHash("sha256")
      .update(`${docName}${mobile_no}${Date.now()}`)
      .digest("hex");
    const storagePath = `${this.docCollection}/${mobile_no}/${sha256DocName}${ext}`;
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
      mediaName: sha256DocName,
      storage_path: storagePath,
      download_url: download_url,
    };

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, mediaFileData, "Audio file saved.");
  }

  public async updateImageOrVideoDiagnosis(
    mediaName: string,
    detections: Array<MediaOutputDetection>,
  ): Promise<Result<MediaData>> {
    const mediaResult: Result<MediaData> = await this.getMediaMetaDataByMediaName(mediaName);

    if (mediaResult.isFailure()) {
      return mediaResult;
    }

    const media: MediaData = mediaResult.getData();

    const mimeType: string = media.mimeType;
    const ext: string = this.extFromMime(mimeType);

    if (!(ext === ".jpg" || ext === ".png" || ext === ".webp" || ext === ".mp4")) {
      return Result.fail(
        ENUM_STATUS_CODES_FAILURE.UNPROCESSABLE_CONTENT,
        "Media to be updated must be either .jpg, .png, .webp, or .mp4.",
      );
    }

    const updateResult: boolean = await mediaRepository.updateImageDiagnosis(mediaName, detections);
    if (!updateResult) {
      throw new Error("updateMediaDiagnosis failed to update.");
    }

    const updatedMedia: Result<MediaData> = await this.getMediaMetaDataByMediaName(mediaName);

    if (updatedMedia.isFailure()) {
      throw new Error("updateMediaDiagnosis failed to get updated data.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, updatedMedia.getData(), "Updated media diagnosis.");
  }

  public async getLocationTutorialImages(): Promise<Result<LocationTutorialImages>> {
    const locationTutorialImages: LocationTutorialImages | undefined =
      await mediaRepository.getLocationTutorialImages();

    if (!locationTutorialImages) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "Location tutorial images not found.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, locationTutorialImages, "Location tutorial images found.");
  }

  public async getImagesAndVideosMetaDataByMobileNo(mobile_no: string): Promise<Result<MediaData[]>> {
    const userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);
    if (userResult.isFailure()) {
      return userResult;
    }

    const imageAndVideos: MediaData[] = await mediaRepository.getImagesAndVideosMetaDataByMobileNo(mobile_no);

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, imageAndVideos, "Diagnosis history successfully retrieved.");
  }
}

export default new MediaService();
