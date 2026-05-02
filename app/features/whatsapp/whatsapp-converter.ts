import ffmpeg from 'fluent-ffmpeg';
import { SpeechClient } from '@google-cloud/speech';
import { google } from '@google-cloud/speech/build/protos/protos';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';


const speechClient = new SpeechClient();

export class WhatsappConverter {
  async convertOggToMp3(oggBuffer: Buffer): Promise<Buffer> {
    const tmpDir    = os.tmpdir();
    const inputPath = path.join(tmpDir, `wa-audio-${Date.now()}.ogg`);
    const outputPath = path.join(tmpDir, `wa-audio-${Date.now()}.mp3`);

    try {
      // Write ogg buffer to tmp file
      await fs.promises.writeFile(inputPath, oggBuffer);

      // Convert ogg/opus → mp3
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .format('mp3')
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });

      // Read mp3 back as buffer
      const mp3Buffer = await fs.promises.readFile(outputPath);
      return mp3Buffer;
    } finally {
      // Clean up tmp files regardless of success or failure
      await fs.promises.unlink(inputPath).catch(() => {});
      await fs.promises.unlink(outputPath).catch(() => {});
    }
  }

  async transcribeAudio(mp3Buffer: Buffer): Promise<string> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT env var is not set');

    const request: google.cloud.speech.v1p1beta1.IRecognizeRequest = {
      audio: {
        content: mp3Buffer.toString('base64'),
      },
      config: {
        encoding:                   'MP3',
        sampleRateHertz:            16000,
        languageCode:               'en-US',
        alternativeLanguageCodes:   ['ms-MY', 'zh-TW'],
        model:                      'chirp-3',
        enableAutomaticPunctuation: true,
      },
    };

    const [response] = await speechClient.recognize(request as any);

    const transcript = response.results
      ?.map((r) => r.alternatives?.[0]?.transcript ?? '')
      .join(' ')
      .trim();

    if (!transcript) {
      console.warn('[transcribeAudio] empty transcript returned');
      return '';
    }

    console.log(`[transcribeAudio] transcript: ${transcript}`);
    return transcript;
  }

  async convertAndTranscribe(oggBuffer: Buffer): Promise<string> {
    const mp3Buffer = await this.convertOggToMp3(oggBuffer);
    return this.transcribeAudio(mp3Buffer);
  }
}

export default new WhatsappConverter();


