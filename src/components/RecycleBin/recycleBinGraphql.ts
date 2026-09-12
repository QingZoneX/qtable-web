import { gql } from "@apollo/client";

export const RECYCLE_BIN_QUERY = gql`
  query RecycleBin($tableId: String!, $offset: Int!, $limit: Int!) {
    recycleBin(tableId: $tableId, offset: $offset, limit: $limit)
  }
`;

export const RECYCLE_BIN_FIELDS_QUERY = gql`
  query RecycleBinFields($tableId: String) {
    fields(tableId: $tableId)
  }
`;

export const RESTORE_RECORD = gql`
  mutation RestoreRecord($tableId: String!, $recordId: ID!) {
    restoreRecord(tableId: $tableId, recordId: $recordId)
  }
`;

export const PURGE_RECORD = gql`
  mutation PurgeRecord(
    $tableId: String!
    $recordId: ID!
    $confirmRecordId: String!
  ) {
    purgeRecord(
      tableId: $tableId
      recordId: $recordId
      confirmRecordId: $confirmRecordId
    )
  }
`;
