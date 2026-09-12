import { gql } from "@apollo/client";

export const MY_WORK_QUERY = gql`
  query MyWork(
    $sections: [String!]
    $limit: Int!
    $cursors: JSON
    $timezone: String!
    $taskState: String!
  ) {
    myWork(
      sections: $sections
      limit: $limit
      cursors: $cursors
      timezone: $timezone
      taskState: $taskState
    )
  }
`;

export const UPSERT_RECENT_TARGET = gql`
  mutation UpsertRecentTarget($target: JSON!) {
    upsertRecentTarget(target: $target)
  }
`;

export const IMPORT_RECENT_TARGETS = gql`
  mutation ImportRecentTargets($targets: [JSON!]!) {
    importRecentTargets(targets: $targets)
  }
`;

export const REMOVE_RECENT_TARGET = gql`
  mutation RemoveRecentTarget(
    $entityType: String!
    $entityId: String!
    $tableId: String
  ) {
    removeRecentTarget(
      entityType: $entityType
      entityId: $entityId
      tableId: $tableId
    )
  }
`;
