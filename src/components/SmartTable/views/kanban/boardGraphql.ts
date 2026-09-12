import { gql } from "@apollo/client";

export const BOARD_VIEW = gql`
  query BoardView(
    $tableId: String!
    $viewId: String!
    $columnKey: String
    $laneKey: String
    $cursor: String
    $limit: Int!
    $filters: [JSON!]
    $sorts: [JSON!]
  ) {
    boardView(
      tableId: $tableId
      viewId: $viewId
      columnKey: $columnKey
      laneKey: $laneKey
      cursor: $cursor
      limit: $limit
      filters: $filters
      sorts: $sorts
    )
  }
`;

export const MOVE_BOARD_CARD = gql`
  mutation MoveBoardCard(
    $tableId: String!
    $viewId: String!
    $recordId: ID!
    $targetColumnKey: String!
    $targetLaneKey: String
    $beforeRecordId: ID
    $afterRecordId: ID
    $expectedRecordVersion: Int
    $expectedOrderRevision: Int
  ) {
    moveBoardCard(
      tableId: $tableId
      viewId: $viewId
      recordId: $recordId
      targetColumnKey: $targetColumnKey
      targetLaneKey: $targetLaneKey
      beforeRecordId: $beforeRecordId
      afterRecordId: $afterRecordId
      expectedRecordVersion: $expectedRecordVersion
      expectedOrderRevision: $expectedOrderRevision
    )
  }
`;

export const UPDATE_BOARD_VIEW_CONFIG = gql`
  mutation UpdateBoardViewConfig(
    $tableId: String!
    $viewId: String!
    $groupFieldId: String!
    $laneFieldId: String
    $cardFieldIds: [String!]
    $hideCompleted: Boolean!
    $collapsedColumns: [String!]
  ) {
    updateBoardViewConfig(
      tableId: $tableId
      viewId: $viewId
      groupFieldId: $groupFieldId
      laneFieldId: $laneFieldId
      cardFieldIds: $cardFieldIds
      hideCompleted: $hideCompleted
      collapsedColumns: $collapsedColumns
    )
  }
`;

export const BOARD_UPDATES = gql`
  subscription BoardUpdates($tableId: String!, $viewId: String!) {
    boardUpdates(tableId: $tableId, viewId: $viewId)
  }
`;
