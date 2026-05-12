import { TranslationServiceClient } from '@google-cloud/translate/build/src/v3beta1';
import { translateServiceConfig } from '../../config/config';
import { LanguageCodeData } from './translate-model';
import { ENUM_STATUS_CODES_SUCCESS } from '../../../libs/status-codes-enum';
import { Result } from '../../../libs/Result';

interface ITranslateService {
  detectLanguage(text: string): Promise<Result<LanguageCodeData>>;
}

class TranslateService implements ITranslateService {
  private translationServiceClient: TranslationServiceClient;

  constructor() {
    this.translationServiceClient = new TranslationServiceClient();
  }

  async detectLanguage(text: string): Promise<Result<LanguageCodeData>> {
    const [response] = await this.translationServiceClient.detectLanguage({
      parent: `projects/${translateServiceConfig.PROJECT_ID}/locations/global`,
      content: text,
      mimeType: 'text/plain',
    });

    const languages = response.languages ?? [];
    if (languages.length === 0) throw new Error("detectLanguage failed to detect.");

    // Returns the most confident language code, e.g. "en", "fr", "ms"
    const language = languages[0];

    if (language) {
      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, { languageCode: language } as LanguageCodeData, "detectLanguage success.");
    }
    throw new Error("detectLanguage failed to detect.");
  }
}

export default new TranslateService();
