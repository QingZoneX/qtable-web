import { gql } from "@apollo/client";

export const WORKSPACE_EXPERIENCE_PREFERENCE = gql`
  query WorkspaceExperiencePreference($workspaceId: String) {
    workspaceExperiencePreference(workspaceId: $workspaceId)
  }
`;

export const SET_MY_WORKSPACE_EXPERIENCE_MODE = gql`
  mutation SetMyWorkspaceExperienceMode($workspaceId: String, $mode: String) {
    setMyWorkspaceExperienceMode(workspaceId: $workspaceId, mode: $mode)
  }
`;

export const SET_WORKSPACE_DEFAULT_EXPERIENCE_MODE = gql`
  mutation SetWorkspaceDefaultExperienceMode($workspaceId: String, $mode: String!) {
    setWorkspaceDefaultExperienceMode(workspaceId: $workspaceId, mode: $mode)
  }
`;
