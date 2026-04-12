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
}

export default new VertexService();
