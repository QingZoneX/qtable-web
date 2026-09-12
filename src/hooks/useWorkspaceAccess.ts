import { useQuery } from "@apollo/client/react";
import { WORKSPACE_MEMBERS } from "../lib/graphql";
import { useAuthStore } from "../store/authStore";

export type WorkspaceMember = {
  userId: number;
  name: string;
  email: string;
  role: string;
};

export const useWorkspaceAccess = (workspaceId?: string) => {
  const token = useAuthStore((state) => state.token);
  const { data, loading, error, refetch } = useQuery<
    { workspaceMembers: WorkspaceMember[] },
    { workspaceId: string }
  >(WORKSPACE_MEMBERS, {
    variables: { workspaceId: workspaceId || "" },
    skip: !workspaceId || !token,
    fetchPolicy: "network-only",
  });
  const members = data?.workspaceMembers ?? [];
  const graphQLErrors =
    (error as { graphQLErrors?: { message: string }[] } | undefined)
      ?.graphQLErrors ?? [];
  const accessDenied = graphQLErrors.some((err: { message: string }) =>
    /unauthorized|no access/i.test(err.message),
  );
  return {
    loading,
    error,
    members,
    accessDenied: Boolean(accessDenied),
    refetch,
  };
};