import { gql } from "@apollo/client";

/**
 * Workspace invitations never request password setup credentials from GraphQL.
 * New-user password setup is delivered only by the backend's configured SMTP
 * path; the inviter receives ordinary member metadata only.
 */
export const INVITE_USER_TO_WORKSPACE_SAFE = gql`
  mutation InviteUserToWorkspace(
    $email: String!
    $workspaceId: ID!
    $role: String!
  ) {
    inviteUserToWorkspace(
      email: $email
      workspaceId: $workspaceId
      role: $role
    ) {
      userId
      name
      email
      role
    }
  }
`;
