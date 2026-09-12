import { gql } from "@apollo/client";

export const GET_RELATION_OPTIONS = gql`
  query RelationOptions(
    $tableId: String!
    $fieldId: String!
    $search: String
    $offset: Int
    $limit: Int
    $recordIds: [String!]
  ) {
    relationOptions(
      tableId: $tableId
      fieldId: $fieldId
      search: $search
      offset: $offset
      limit: $limit
      recordIds: $recordIds
    )
  }
`;

export const GET_TABLE_FIELDS_ONLY = gql`
  query RelationTargetFields($tableId: String) {
    fields(tableId: $tableId)
  }
`;
