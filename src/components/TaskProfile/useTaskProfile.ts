import { useQuery } from "@apollo/client/react";
import {
  TASK_PROFILE_QUERY,
  type TaskProfilePayload,
} from "./taskProfile";

type TaskProfileQueryData = {
  taskProfile: TaskProfilePayload | null;
};

export function useTaskProfile(tableId?: string | null) {
  const query = useQuery<TaskProfileQueryData>(TASK_PROFILE_QUERY, {
    variables: { tableId: tableId || "" },
    skip: !tableId,
    fetchPolicy: "cache-and-network",
  });

  return {
    ...query,
    profile: query.data?.taskProfile || null,
  };
}
