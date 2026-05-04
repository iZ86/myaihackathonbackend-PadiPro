import { speechConfig } from "../../config/config";
import ffmpeg = require('fluent-ffmpeg');
import ffmpegStatic = require('ffmpeg-static');
import { SpeechClient } from '@google-cloud/speech/build/src/v2';
import { protos } from '@google-cloud/speech';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);

const REGION = 'us';

export class WhatsappConverter {

  private getSpeechClient(): SpeechClient {
    return new SpeechClient({
      apiEndpoint: `${REGION}-speech.googleapis.com`,
    });
  }

  async convertOggToMp3(oggBuffer: Buffer): Promise<Buffer> {
    const tmpDir     = os.tmpdir();
    const inputPath  = path.join(tmpDir, `wa-audio-${Date.now()}.ogg`);
    const outputPath = path.join(tmpDir, `wa-audio-${Date.now()}.mp3`);

    try {
      await fs.promises.writeFile(inputPath, oggBuffer);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .format('mp3')
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .save(outputPath);
      });

      return await fs.promises.readFile(outputPath);
    } finally {
      await fs.promises.unlink(inputPath).catch(() => {});
      await fs.promises.unlink(outputPath).catch(() => {});
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const projectId = speechConfig.GOOGLE_CLOUD_PROJECT;
    if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT env var is not set');

    const client = this.getSpeechClient();

    const request: protos.google.cloud.speech.v2.IRecognizeRequest = {
      recognizer: `projects/${projectId}/locations/${REGION}/recognizers/_`,
      config: {
        autoDecodingConfig: {},
        languageCodes: ['ms-MY', 'cmn-Hans-CN'],
        model: 'chirp_3',
      },
      content: audioBuffer,
    };

    try {
      const [response] = await client.recognize(request);

      const transcript = response.results
        ?.map((r) => r.alternatives?.[0]?.transcript ?? '')
        .join(' ')
        .trim();

      if (!transcript) {
        console.warn('[transcribeAudio] empty transcript returned');
        return '⚠️ I couldn’t detect any speech in the audio.';
      }

      return transcript;

    } catch (err: any) {
      console.error('[transcribeAudio] error:', err);

      if (err.code === 3) {
        return '⏱️ Your audio is too long (max 60 seconds). Please send a shorter voice message.';
      }

      return '❌ Something went wrong while processing your audio. Please try again.';
    }
  }

  async convertAndTranscribe(oggBuffer: Buffer): Promise<string> {
    const mp3Buffer = await this.convertOggToMp3(oggBuffer);
    return this.transcribeAudio(mp3Buffer);
  }
}

export default new WhatsappConverter();