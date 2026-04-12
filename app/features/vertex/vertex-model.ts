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

export interface VertexSessionInfoData {
  session: string;
  queryId: string;
}
