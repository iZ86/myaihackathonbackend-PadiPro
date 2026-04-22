export interface VertexAnswerData {
  answer: {
    name: string;
    state: string;
    answerText: string;
    citations: {
      startIndex: string;
      endIndex: string;
      sources: {
        referenceId: string;
      }[];
    }[];
    references: {
      chunkInfo: {
        content: string;
        revelanceScore: number;
        documentMetaData: {
          document: string;
          uri: string;
          title: string;
        }
      }
    }[];
    relatedQuestions: string[];
    queryUnderstandingInfo: {
      queryClassificationInfo: {
        type: string;
      }[];
    };
  };
  session: {
    name: string;
    state: string;
    userPseudoId: string;
    turns: {
      query: {
        queryId: string;
        text: string;
      };
      answer: string;
    }[];
    startTime: string;
    endTime: string;
  };
  answerQueryToken: string;
}

export interface VertexAnswerQueryData {
  answer: {
    state: string;
    answerText: string;
  },
  relatedQuestions: string[];
  session: string;
  query: string;
}

export interface VertexSessionInfoData {
  session: string;
}
