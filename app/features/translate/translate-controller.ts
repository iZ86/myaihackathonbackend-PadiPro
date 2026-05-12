import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import translateService from "./translate-service";
import { LanguageCodeData } from "./translate-model";

export default class TranslateController {

  async detectLanguage(req: Request, res: Response) {

    const text: string = req.body.text;

    const result: Result<LanguageCodeData> = await translateService.detectLanguage(text);

    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }

  }

}
