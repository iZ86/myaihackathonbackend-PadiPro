import { ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { vertexServiceConfig } from "../../config/config";
import { VertexAnswerQueryData, VertexSessionInfoData } from "./vertex-model";
import { ConversationalSearchServiceClient, protos } from "@google-cloud/discoveryengine";

interface IVertexService {
  createVertexSession(): Promise<Result<VertexSessionInfoData>>;
  sendQueryVertex(text: string, session: string): Promise<Result<VertexAnswerQueryData>>;
}

class VertexService implements IVertexService {


  private conversationalSearchClient: ConversationalSearchServiceClient;
  private conversationalSearchParent: string;
  private servingConfig: string;

  constructor() {
    this.conversationalSearchClient = new ConversationalSearchServiceClient();
    this.conversationalSearchParent = `projects/${vertexServiceConfig.VERTEX_PROJECT_ID}/locations/${vertexServiceConfig.VERTEX_LOCATION}/collections/${vertexServiceConfig.VERTEX_COLLECTION}/engines/${vertexServiceConfig.VERTEX_ENGINE_ID}`;
    this.servingConfig = `${this.conversationalSearchParent}/servingConfigs/${vertexServiceConfig.VERTEX_SERVING_CONFIG}`;
  }


  public async createVertexSession(): Promise<Result<VertexSessionInfoData>> {

    try {
      const [session] = await this.conversationalSearchClient.createSession({
        parent: this.conversationalSearchParent,
        session: {
          state: 'IN_PROGRESS',
        },
      });

      if (!session.name) {
        throw new Error('createVertexSession session created but no name returned');
      }

      const vertexSessionInfo: VertexSessionInfoData = {
        session: session.name,
      }

      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, vertexSessionInfo, "Successfully created Vertex AI Search session.");

    } catch (error) {
      console.error('Vertex API Error:', error);
      throw error;
    }
  }

  public async sendQueryVertex(text: string, session: string): Promise<Result<VertexAnswerQueryData>> {

    const preamble: string | null = process.env.VERTEX_PROMPT_SEC ? process.env.VERTEX_PROMPT_SEC : null;
    const modelSpec: string | null = process.env.VERTEX_MODEL_VERSION ? process.env.VERTEX_MODEL_VERSION : null;
    try {

      const [response] = await this.conversationalSearchClient.answerQuery({

        servingConfig: this.servingConfig,
        query: { text },
        session: session,
        relatedQuestionsSpec: { enable: true },
        answerGenerationSpec: {
          // maps to your ignoreAdversarialQuery etc.
          ignoreAdversarialQuery: true,
          ignoreNonAnswerSeekingQuery: true,
          ignoreLowRelevantContent: true,
          includeCitations: true,

          promptSpec: {
            preamble: preamble,
          },

          modelSpec: {
            modelVersion: modelSpec,
          },
        },

        queryUnderstandingSpec: {
          queryClassificationSpec: {
            types: [
              protos.google.cloud.discoveryengine.v1alpha
                .AnswerQueryRequest.QueryUnderstandingSpec.QueryClassificationSpec.Type
                .NON_ANSWER_SEEKING_QUERY
            ],
          },
        },
      });

      if (!response.answer) {
        throw new Error('sendQueryVertex response received but no answer returned');
      }

      if (!response.answer.answerText) {
        throw new Error('sendQueryVertex response received but no answerText returned');
      }

      if (!response.answer.state) {
        throw new Error('sendQueryVertex response received but no state returned');
      }

      if (!response.answer.relatedQuestions) {
        throw new Error('sendQueryVertex response received but no related questions returned');
      }

      const vertexAnswerQuery: VertexAnswerQueryData = {
        answer: {
          answerText: response.answer.answerText,
          state: response.answer.state.toString()
        },
        relatedQuestions: response.answer.relatedQuestions,
        session: session,
        query: text
      }

      return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, vertexAnswerQuery, "Successfully sent query to Vertex AI Search.");

    } catch (error) {
      console.error('Fetch Error:', error);
      throw error;
    }
  }
}

export default new VertexService();
