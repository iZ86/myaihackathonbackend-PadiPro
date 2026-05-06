interface IMediaRepository {
}
class MediaRepository implements IMediaRepository {
  private readonly collection: string = 'medias';
}

export default new MediaRepository();
