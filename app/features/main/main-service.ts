import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { MediaData } from "../media/media-model";
import { UserData } from "../user/user-model";
import vertexService from "../vertex/vertex-service";
import { VertexAnswerQueryData, VertexSessionInfoData } from "../vertex/vertex-model";
import { WeatherData } from "../weather/weather-model";
import weatherService from "../weather/weather-service";
import userService from "../user/user-service";
import { ImageOutput } from "../gemini/gemini-model";
import geminiService from "../gemini/gemini-service";
import mediaService from "../media/media-service";

interface IMainService {
  handleText(mobile_no: string, text: string): Promise<Result<string>>;
  handleImage(mobile_no: string, mediaName: string): Promise<Result<string>>;
  handleVideo(mobile_no: string, mediaName: string): Promise<Result<string>>;
  handleLocation(mobile_no: string, latitude: number, longitude: number): Promise<Result<UserData>>;
}

// Testing to hold vertex sessions
const userVertexSession: { [mobile_no: string]: string } = {};

class MainService implements IMainService {

  public async handleText(mobile_no: string, text: string): Promise<Result<string>> {

    await this.syncUserWeather(mobile_no);

    const weatherQuery: string = await this.generateWeatherQuery(mobile_no);


    const session: string = await this.getOrCreateVertexSession(mobile_no);


    const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(text + weatherQuery, session);


    const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();

    if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {

      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "I specialize in rice paddy disease analysis. Could you clarify how your question relates to crop health?", "handleText success.");
    } else {
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, sendQueryVertex.answer.answerText, "handleText success.");
    }
  }

  public async handleImage(mobile_no: string, mediaName: string): Promise<Result<string>> {


    const imageResult: Result<MediaData> = await mediaService.getMediaMetaDataByMediaName(mediaName);
    if (imageResult.isFailure()) {
      throw new Error(`handleImage failed to retrieve image: ${imageResult.getMessage()}`);
    }

    const image: MediaData = imageResult.getData();

    const geminiImageResult: Result<ImageOutput> = await geminiService.image(image.download_url);
    if (geminiImageResult.isFailure()) {

      const deleteImageResult: Result<null> = await mediaService.deleteMediaByMediaName(mediaName);
      if (deleteImageResult.isFailure()) {
        throw new Error(`handleImage delete image failed: ${deleteImageResult.isFailure()}`);
      }

      if (geminiImageResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE && geminiImageResult.getMessage() === "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.") {

        return Result.fail(ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE, "We are currently experiencing high demand, please try again later.");

      } else if (geminiImageResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS && geminiImageResult.getMessage() === "Resource has been exhausted (e.g. check quota).") {

        return Result.fail(ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS, "You are sending images too frequently, please send again in 1 minute.");

      }
      throw Error(`handleImage error, gemini error code ${geminiImageResult.getStatusCode()}: ${geminiImageResult.getMessage()}`);
    }

    const imageOutput: ImageOutput = geminiImageResult.getData();

    if (imageOutput.detections[0]?.disease === "NOT DETECTED") {

      const deleteImageResult: Result<null> = await mediaService.deleteMediaByMediaName(mediaName);
      if (deleteImageResult.isFailure()) {
        throw new Error(`handleImage delete image failed: ${deleteImageResult.getMessage()}`);
      }
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "I couldn’t detect any rice paddies in this image. Please upload an image that clearly shows a rice field for analysis.", "handleImage success.");

    } else if (imageOutput.detections[0]?.disease === "HEALTHY") {

      const image: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(mediaName, imageOutput.detections);
      if (image.isFailure()) {
        throw new Error(`handleImage failed to update image dianogsis: ${image.getMessage()}`);
      }

      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "No visible signs of disease detected. The rice plants appear healthy based on this image.", "handleImage success.");

    } else {

      const image: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(mediaName, imageOutput.detections);
      if (image.isFailure()) {
        throw new Error(`handleImage failed to update image dianogsis: ${image.getMessage()}`);
      }


      console.log(`[Whatsapp] Syncing weather status`);
      await this.syncUserWeather(mobile_no);
      console.log(`[Whatsapp] Weather status synced`);

      const weatherQuery: string = await this.generateWeatherQuery(mobile_no);

      console.log(`[Vertex] Creating session`);
      const session: string = await this.getOrCreateVertexSession(mobile_no);
      console.log(`[Vertex] Session created`);

      const defaultQuery: string = `What causes ${imageOutput.detections[0]?.disease}? Generate a 7-day plan to solve it in a farm. `;

      console.log(`[Vertex] Sending response to Vertex`);
      const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(defaultQuery + weatherQuery, session);
      console.log(`[Vertex] Response received`);

      const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();
      if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {
        return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "I’m not confident in identifying this condition based on my current knowledge. Please provide more details.", "handleImage success.");
      } else {

        // Generate sendText response

        return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, sendQueryVertex.answer.answerText, "handleImage success.");

        // Generate sendImage response

        // Generate sendDocument response
      }
    }

  }


  public async handleVideo(mobile_no: string, mediaName: string): Promise<Result<string>> {



    const videoResult: Result<MediaData> = await mediaService.getMediaMetaDataByMediaName(mediaName);
    if (videoResult.isFailure()) {
      throw new Error(`handleVideo failed to retrieve video: ${videoResult.getMessage()}`);
    }

    const video: MediaData = videoResult.getData();

    const geminiImageResult: Result<ImageOutput> = await geminiService.image(video.download_url);
    if (geminiImageResult.isFailure()) {

      const deleteVideoResult: Result<null> = await mediaService.deleteMediaByMediaName(mediaName);
      if (deleteVideoResult.isFailure()) {
        throw new Error(`handleVideo delete video failed: ${deleteVideoResult.getMessage()}`);
      }

      if (geminiImageResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE && geminiImageResult.getMessage() === "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.") {
        return Result.fail(ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE, "We are currently experiencing high demand, please try again later.");
      } else if (geminiImageResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS && geminiImageResult.getMessage() === "Resource has been exhausted (e.g. check quota).") {
        return Result.fail(ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS, "You are sending videos too frequently, please send again in 1 minute.");
      }
      throw Error(`handleVideo error, gemini error code ${geminiImageResult.getStatusCode()}: ${geminiImageResult.getMessage()}`);
    }

    const imageOutput: ImageOutput = geminiImageResult.getData();

    if (imageOutput.detections[0]?.disease === "NOT DETECTED") {

      const deleteVideoResult: Result<null> = await mediaService.deleteMediaByMediaName(mediaName);
      if (deleteVideoResult.isFailure()) {
        throw new Error(`handleVideo delete video failed: ${deleteVideoResult.getMessage()}`);
      }
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "I couldn’t detect any rice paddies in this image. Please upload an image that clearly shows a rice field for analysis.", "handleVideo success.");

    } else if (imageOutput.detections[0]?.disease === "HEALTHY") {

      const image: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(mediaName, imageOutput.detections);
      if (image.isFailure()) {
        throw new Error(`handleImage failed to update image dianogsis: ${image.getMessage()}`);
      }
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "No visible signs of disease detected. The rice plants appear healthy based on this image.", "handleVideo success.");

    } else {

      const image: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(mediaName, imageOutput.detections);
      if (image.isFailure()) {
        throw new Error(`handleImage failed to update image dianogsis: ${image.getMessage()}`);
      }


      console.log(`[Whatsapp] Syncing weather status`);
      await this.syncUserWeather(mobile_no);
      console.log(`[Whatsapp] Weather status synced`);

      const weatherQuery: string = await this.generateWeatherQuery(mobile_no);

      console.log(`[Vertex] Creating session`);
      const session: string = await this.getOrCreateVertexSession(mobile_no);
      console.log(`[Vertex] Session created`);

      const defaultQuery: string = `What causes ${imageOutput.detections[0]?.disease}? Generate a 7-day plan to solve it in a farm. `;

      console.log(`[Vertex] Sending response to Vertex`);
      const sendQueryVertexResult: Result<VertexAnswerQueryData> = await vertexService.sendQueryVertex(defaultQuery + weatherQuery, session);
      console.log(`[Vertex] Response received`);

      const sendQueryVertex: VertexAnswerQueryData = sendQueryVertexResult.getData();
      if (sendQueryVertex.answer.answerText === "A summary could not be generated for your search query. Here are some search results.") {
        return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, "I’m not confident in identifying this condition based on my current knowledge. Please provide more details.", "handleVideo success.");
      } else {

        // Generate sendText response
        return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, sendQueryVertex.answer.answerText, "handleVideo success.");

        // Generate sendImage response

        // Generate sendDocument response
      }
    }

  }


  public async handleLocation(mobile_no: string, latitude: number, longitude: number): Promise<Result<UserData>> {


    const userResult: Result<UserData> = await userService.updateUserCoordsByMobileNo(latitude, longitude, mobile_no);
    if (userResult.isFailure()) {
      return Result.fail(userResult.getStatusCode(), userResult.getMessage());
    }

    const user: Result<UserData> = await userService.getUserByMobileNo(mobile_no);
    if (user.isFailure()) {
      return Result.fail(user.getStatusCode(), user.getMessage());
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, user.getData(), "handleLocation success.");
  }

  private async syncUserWeather(mobile_no: string): Promise<undefined> {

    const getWeatherResult: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobile_no);

    if (getWeatherResult.isSuccess()) {

      const updateWeatherResult: Result<WeatherData> = await weatherService.updateWeather(mobile_no);

      if (updateWeatherResult.isFailure() &&
        ((updateWeatherResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.NOT_FOUND && updateWeatherResult.getMessage() !== "User location is not set.") ||
          (updateWeatherResult.getStatusCode() !== ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS))) {

        throw new Error(`handleText had issue with updateWeather: ${updateWeatherResult.getMessage()}`);
      }


    } else if (getWeatherResult.isFailure() && getWeatherResult.getMessage() === "User weather not found.") {

      const saveWeatherResult: Result<WeatherData> = await weatherService.saveWeather(mobile_no);

      if (saveWeatherResult.isFailure() && saveWeatherResult.getMessage() !== "User location is not set.") {
        throw new Error(`handleText had issue with saveWeather: ${saveWeatherResult.getMessage()}`);
      }

    } else {
      throw new Error("handleText failed to get weather.");
    }
  }

  private async generateWeatherQuery(mobile_no: string): Promise<string> {

    const weatherResult: Result<WeatherData> = await weatherService.getWeatherByMobileNo(mobile_no);

    let weatherQuery: string = "";

    if (weatherResult.isSuccess()) {
      const weather: WeatherData = weatherResult.getData();
      const condition = weather.weatherCondition?.replace(/_/g, " ").toLowerCase();
      const temp = `${weather.temperature?.degrees}°${weather.temperature?.unit === "CELSIUS" ? "C" : "F"}`;
      const feelsLike = weather.dewPoint ? `dew point ${weather.dewPoint.degrees}°C` : "";
      const humidity = `humidity ${weather.relativeHumidity}%`;
      const wind = `wind ${weather.wind?.speed?.value} ${weather.wind?.speed?.unit?.replace(/_/g, " ").toLowerCase()} from ${weather.wind?.direction?.cardinal?.replace(/_/g, " ")}`;
      const gusts = weather.wind?.gust?.value ? `, gusting to ${weather.wind.gust.value} km/h` : "";
      const cloud = `cloud cover ${weather.cloudCover}%`;
      const rainChance = `${weather.precipitation?.probability?.percent}% chance of ${weather.precipitation?.probability?.type?.toLowerCase()}`;
      const thunderChance = (weather.thunderstormProbability ? weather.thunderstormProbability > 0 : false) ? `, ${weather.thunderstormProbability}% chance of thunderstorms` : "";
      const qpf = (weather.precipitation?.qpf.quantity ? weather.precipitation?.qpf?.quantity > 0 : false)
        ? `, expected rainfall ${weather.precipitation?.qpf.quantity} ${weather.precipitation?.qpf.unit.toLowerCase()}`
        : "";


      weatherQuery =
        "\nAdditionally, here are the current weather conditions that you may reference when tailoring the personalized solution plan: " +
        `\nCurrent weather conditions:` +
        `\n- Condition: ${condition}` +
        `\n- Temperature: ${temp}, ${feelsLike}, ${humidity}` +
        `\n- Wind: ${wind}${gusts}` +
        `\n- Sky: ${cloud}` +
        `\n- Precipitation: ${rainChance}${thunderChance}${qpf}`;
    } else if (weatherResult.isFailure() && weatherResult.getMessage() !== "User weather not found.") {
      // If the weather is still not set by here. Means that the user has no location set.
      // Hence, don't throw error unless its something else other than no user location set.
      throw new Error(`handleText could not getWeather due to other reasons: ${weatherResult.getMessage()}`);
    }

    return weatherQuery;
  }

  private async getOrCreateVertexSession(mobile_no: string): Promise<string> {
    return userVertexSession[mobile_no] ?? await (async () => {
      const createVertexSessionResult: Result<VertexSessionInfoData> = await vertexService.createVertexSession();
      if (createVertexSessionResult.isSuccess()) {
        const vertexSession: VertexSessionInfoData = createVertexSessionResult.getData();
        userVertexSession[mobile_no] = vertexSession.session;
        return vertexSession.session;
      }
      throw new Error("handleText failed to create vertex session.");
    })();
  }

}

export default new MainService();
