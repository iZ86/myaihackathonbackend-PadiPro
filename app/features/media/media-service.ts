import { Result } from "../../../libs/Result";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { MediaData } from "./media-model";
import mediaRepository from "./media-repository";

interface IMediaService {
  getMediaMetaDataByMediaName(mediaName: string): Promise<Result<MediaData>>;
}


class MediaService implements IMediaService {
 
  public async getMediaMetaDataByMediaName(mediaName: string): Promise<Result<MediaData>> {
    const media: MediaData | undefined = await mediaRepository.getMediaMetaDataByMediaName(mediaName);
    if (!media) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "Media meta data not found.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, media, "Media meta data found.");
  }
}

export default new MediaService();
