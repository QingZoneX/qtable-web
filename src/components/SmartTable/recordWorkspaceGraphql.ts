import { gql } from "@apollo/client";

export const RECORD_HISTORY = gql`
  query RecordHistory(
    $tableId: String!
    $recordId: ID!
    $offset: Int!
    $limit: Int!
  ) {
    recordHistory(
      tableId: $tableId
      recordId: $recordId
      offset: $offset
      limit: $limit
    )
  }
`;
