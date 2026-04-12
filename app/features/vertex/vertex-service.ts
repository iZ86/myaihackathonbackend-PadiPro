import { vertexServiceConfig } from "../../config/config";

interface IVertexService {
}

class VertexService implements IVertexService {

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
