import { Request, Response } from "express";
import { Result } from "../../../libs/Result";
import vertexService from "./vertex-service";
import { VertexSessionInfoData } from "./vertex-model";


export default class VertexController {

  async createVertexSession(req: Request, res: Response) {
    const result: Result<VertexSessionInfoData> = await vertexService.createVertexSession();
    if (result.isSuccess()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage(), result.getData());
    } else if (result.isFailure()) {
      return res.sendResponse(result.getStatusCode(), result.getMessage());
    }
  }
}
