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
