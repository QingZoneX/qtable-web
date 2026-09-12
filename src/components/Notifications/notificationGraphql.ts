import { gql } from "@apollo/client";

export const NOTIFICATIONS = gql`
  query Notifications(
    $cursor: String
    $limit: Int!
    $unreadOnly: Boolean!
    $types: [String!]
    $timezone: String!
  ) {
    notifications(
      cursor: $cursor
      limit: $limit
      unreadOnly: $unreadOnly
      types: $types
      timezone: $timezone
    )
  }
`;

export const NOTIFICATION_UNREAD_COUNT = gql`
  query NotificationUnreadCount($timezone: String!) {
    notificationUnreadCount(timezone: $timezone)
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($notificationId: ID!) {
    markNotificationRead(notificationId: $notificationId)
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead($types: [String!]) {
    markAllNotificationsRead(types: $types)
  }
`;

export const NOTIFICATION_UPDATES = gql`
  subscription NotificationUpdates($timezone: String!) {
    notificationUpdates(timezone: $timezone)
  }
`;

export const RECORD_COMMENTS = gql`
  query RecordComments(
    $tableId: String!
    $recordId: ID!
    $cursor: String
    $limit: Int!
  ) {
    recordComments(
      tableId: $tableId
      recordId: $recordId
      cursor: $cursor
      limit: $limit
    )
  }
`;

export const MENTION_CANDIDATES = gql`
  query MentionCandidates($tableId: String!) {
    mentionCandidates(tableId: $tableId)
  }
`;

export const CREATE_RECORD_COMMENT = gql`
  mutation CreateRecordComment(
    $tableId: String!
    $recordId: ID!
    $body: String!
    $mentionUserIds: [Int!]
    $parentCommentId: ID
    $clientMutationId: String
  ) {
    createRecordComment(
      tableId: $tableId
      recordId: $recordId
      body: $body
      mentionUserIds: $mentionUserIds
      parentCommentId: $parentCommentId
      clientMutationId: $clientMutationId
    )
  }
`;

export const UPDATE_RECORD_COMMENT = gql`
  mutation UpdateRecordComment(
    $commentId: ID!
    $body: String!
    $mentionUserIds: [Int!]
    $expectedRevision: Int
  ) {
    updateRecordComment(
      commentId: $commentId
      body: $body
      mentionUserIds: $mentionUserIds
      expectedRevision: $expectedRevision
    )
  }
`;

export const DELETE_RECORD_COMMENT = gql`
  mutation DeleteRecordComment($commentId: ID!, $expectedRevision: Int) {
    deleteRecordComment(
      commentId: $commentId
      expectedRevision: $expectedRevision
    )
  }
`;

export const RECORD_ACTIVITY = gql`
  query RecordActivity(
    $tableId: String!
    $recordId: ID!
    $cursor: String
    $limit: Int!
  ) {
    recordActivity(
      tableId: $tableId
      recordId: $recordId
      cursor: $cursor
      limit: $limit
    )
  }
`;
