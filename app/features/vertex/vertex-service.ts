import { ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { vertexServiceConfig } from "../../config/config";
import { VertexAnswerData, VertexAnswerQueryData, VertexSessionData, VertexSessionInfoData } from "./vertex-model";
import { ConversationalSearchServiceClient } from "@google-cloud/discoveryengine";

interface IVertexService {
  createVertexSession(): Promise<Result<VertexSessionInfoData>>;
  sendQueryVertex(text: string, session: string): Promise<Result<VertexAnswerQueryData>>;
}

class VertexService implements IVertexService {


  private conversationalSearchClient: ConversationalSearchServiceClient;
  private conversationalSearchParent: string;

  constructor() {
    this.conversationalSearchClient = new ConversationalSearchServiceClient();
    this.conversationalSearchParent = `projects/${vertexServiceConfig.VERTEX_PROJECT_ID}/locations/${vertexServiceConfig.VERTEX_LOCATION}/collections/${vertexServiceConfig.VERTEX_COLLECTION}/engines/${vertexServiceConfig.VERTEX_ENGINE_ID}`;
  }


  public async createVertexSession(): Promise<Result<VertexSessionInfoData>> {
    const createVertexSessionResponse: Response = await this.fetchCreateVertexSessionAPI();

    if (!createVertexSessionResponse.ok) {
      const errorData = await createVertexSessionResponse.json();
      console.error('Vertex API Error:', errorData);
      throw new Error(`Vertex API responded with status: ${createVertexSessionResponse.status}`);
    }

    const createVertexSessionData: VertexSessionData = await createVertexSessionResponse.json() as VertexSessionData;

    const vertexSessionInfo: VertexSessionInfoData = {
      session: createVertexSessionData.sessionInfo.name
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, vertexSessionInfo, "Successfully created Vertex AI Search session.");
  }

  public async sendQueryVertex(text: string, session: string): Promise<Result<VertexAnswerQueryData>> {
    const sendQueryVertexResponse: Response = await this.fetchSendQueryVertexAPI(text, session);

    if (!sendQueryVertexResponse.ok) {
      const errorData = await sendQueryVertexResponse.json();
      console.error('Vertex API Error:', errorData);
      throw new Error(`Vertex API responded with status: ${sendQueryVertexResponse.status}`);
    }

    const searchQueryVertexData: VertexAnswerData = await sendQueryVertexResponse.json() as VertexAnswerData;

    const vertexAnswerQuery: VertexAnswerQueryData = {
      answer: {
        answerText: searchQueryVertexData.answer.answerText,
        state: searchQueryVertexData.answer.state
      },
      relatedQuestions: searchQueryVertexData.answer.relatedQuestions,
      session: session,
      query: text
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, vertexAnswerQuery, "Successfully sent query to Vertex AI Search.");
  }

  private async fetchCreateVertexSessionAPI(): Promise<Response> {
    const url: string = vertexServiceConfig.VERTEX_CREATE_SESSION_URL;

    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vertexServiceConfig.VERTEX_GCLOUD_AUTH_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "queryExpansionSpec": { "condition": "AUTO" },
          "spellCorrectionSpec": { "mode": "AUTO" },
          "languageCode": "en-US",
          "contentSearchSpec": { "snippetSpec": { "returnSnippet": true } },
          "userInfo": { "timeZone": "Asia/Kuala_Lumpur" },
          "session": vertexServiceConfig.VERTEX_SESSION_URL
        }),
        mode: "cors"
      });
    } catch (error) {
      console.error('Fetch Error:', error);
      throw error;
    }
  }

  private async fetchSendQueryVertexAPI(text: string, session: string): Promise<Response> {
    const url: string = vertexServiceConfig.VERTEX_SEND_QUERY_URL;

    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vertexServiceConfig.VERTEX_GCLOUD_AUTH_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "query": { "text": text },
          "session": session,
          "relatedQuestionsSpec": { "enable": true },
          "answerGenerationSpec": {
            "ignoreAdversarialQuery": true,
            "ignoreNonAnswerSeekingQuery": true,
            "ignoreLowRelevantContent": true,
            "multimodalSpec": {},
            "includeCitations": true,
            "promptSpec": { "preamble": vertexServiceConfig.VERTEX_PROMPT_SEC },
            "modelSpec": { "modelVersion": vertexServiceConfig.VERTEX_MODEL_VERSION }
          },
          "queryUnderstandingSpec": { "queryClassificationSpec": { "types": ["NON_ANSWER_SEEKING_QUERY", "NON_ANSWER_SEEKING_QUERY_V2"] } }
        }),
        mode: "cors"
      });
    } catch (error) {
      console.error('Fetch Error:', error);
      throw error;
    }
  }

}

export default new VertexService();
