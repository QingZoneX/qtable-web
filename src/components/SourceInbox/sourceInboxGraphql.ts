import { gql } from "@apollo/client";

export const SOURCE_INBOX_ITEMS = gql`
  query SourceInboxItems(
    $workspaceId: String!
    $status: String
    $search: String
    $offset: Int!
    $limit: Int!
  ) {
    sourceInboxItems(
      workspaceId: $workspaceId
      status: $status
      search: $search
      offset: $offset
      limit: $limit
    )
  }
`;

export const PREVIEW_SOURCE_INBOX_ITEM = gql`
  mutation PreviewSourceInboxItem(
    $itemId: String!
    $targetTableId: String
    $model: String
  ) {
    previewSourceInboxItem(
      itemId: $itemId
      targetTableId: $targetTableId
      model: $model
    )
  }
`;

export const CONVERT_SOURCE_INBOX_ITEM = gql`
  mutation ConvertSourceInboxItem(
    $itemId: String!
    $targetTableId: String!
    $title: String!
    $description: String!
    $priority: String!
    $assigneeUserId: Int
    $workloadHours: Float
  ) {
    convertSourceInboxItem(
      itemId: $itemId
      targetTableId: $targetTableId
      title: $title
      description: $description
      priority: $priority
      assigneeUserId: $assigneeUserId
      workloadHours: $workloadHours
    )
  }
`;

export const UPDATE_SOURCE_INBOX_STATUS = gql`
  mutation UpdateSourceInboxStatus($itemIds: [String!]!, $status: String!) {
    updateSourceInboxStatus(itemIds: $itemIds, status: $status)
  }
`;
