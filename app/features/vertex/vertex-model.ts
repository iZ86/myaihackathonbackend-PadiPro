export interface VertexSessionData {
  results: {
    id: string,
    document: {
      name: string,
      id: string,
      derivedStructData: {
        snippets: {
          snippet_status: string,
          snippet: string
        }[],
        title: string,
        link: string,
        can_fetch_raw_content: string
      }
    }
  }[],
  totalSize: number,
  attributionToken: string,
  nextPageToken: string,
  guidedSearchResult: {},
  summary: {},
  queryExpansionInfo: {},
  sessionInfo: {
    name: string,
    queryId: string
  },
  semanticState: string
}

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
  queryId: string;
}
