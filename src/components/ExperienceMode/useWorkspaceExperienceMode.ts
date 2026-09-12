import { useMutation, useQuery } from "@apollo/client/react";
import { useCallback } from "react";
import { useAuthStore } from "../../store/authStore";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import {
  SET_MY_WORKSPACE_EXPERIENCE_MODE,
  SET_WORKSPACE_DEFAULT_EXPERIENCE_MODE,
  WORKSPACE_EXPERIENCE_PREFERENCE,
} from "./experienceModeGraphql";

export type ExperienceMode = "simple" | "advanced";

export type WorkspaceExperiencePreference = {
  workspaceId: string;
  workspaceDefaultMode: ExperienceMode;
  userMode: ExperienceMode | null;
  effectiveMode: ExperienceMode;
  followsWorkspaceDefault: boolean;
  canManageWorkspaceDefault: boolean;
  role: string;
  persistent: boolean;
};

const asMode = (value: unknown): ExperienceMode =>
  String(value).toLowerCase() === "advanced" ? "advanced" : "simple";

const normalizePreference = (
  value: unknown,
  workspaceId: string,
): WorkspaceExperiencePreference | null => {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const rawUserMode = payload.userMode;
  return {
    workspaceId: String(payload.workspaceId || workspaceId),
    workspaceDefaultMode: asMode(payload.workspaceDefaultMode),
    userMode:
      rawUserMode === null || rawUserMode === undefined
        ? null
        : asMode(rawUserMode),
    effectiveMode: asMode(payload.effectiveMode),
    followsWorkspaceDefault: Boolean(payload.followsWorkspaceDefault),
    canManageWorkspaceDefault: Boolean(payload.canManageWorkspaceDefault),
    role: String(payload.role || ""),
    persistent: payload.persistent !== false,
  };
};

export function useWorkspaceExperienceMode(workspaceIdOverride?: string | null) {
  const token = useAuthStore((state) => state.token);
  const storedWorkspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const workspaceId = workspaceIdOverride || storedWorkspaceId || "";

  const { data, loading, error, refetch } = useQuery<{
    workspaceExperiencePreference?: unknown;
  }>(WORKSPACE_EXPERIENCE_PREFERENCE, {
    variables: { workspaceId: workspaceId || null },
    skip: !token || !workspaceId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const [setPersonalMutation, { loading: personalSaving }] = useMutation(
    SET_MY_WORKSPACE_EXPERIENCE_MODE,
  );
  const [setWorkspaceDefaultMutation, { loading: workspaceSaving }] = useMutation(
    SET_WORKSPACE_DEFAULT_EXPERIENCE_MODE,
  );

  const preference = normalizePreference(
    data?.workspaceExperiencePreference,
    workspaceId,
  );
  const effectiveMode = preference?.effectiveMode || "simple";

  const refresh = useCallback(async () => {
    if (!workspaceId) return null;
    const result = await refetch({ workspaceId });
    return normalizePreference(
      result.data?.workspaceExperiencePreference,
      workspaceId,
    );
  }, [refetch, workspaceId]);

  const setPersonalMode = useCallback(
    async (mode: ExperienceMode | null) => {
      if (!workspaceId) throw new Error("当前工作区不可用");
      const result = await setPersonalMutation({
        variables: { workspaceId, mode },
      });
      const payload = normalizePreference(
        (result.data as { setMyWorkspaceExperienceMode?: unknown } | undefined)
          ?.setMyWorkspaceExperienceMode,
        workspaceId,
      );
      await refetch({ workspaceId });
      return payload;
    },
    [refetch, setPersonalMutation, workspaceId],
  );

  const setWorkspaceDefaultMode = useCallback(
    async (mode: ExperienceMode) => {
      if (!workspaceId) throw new Error("当前工作区不可用");
      const result = await setWorkspaceDefaultMutation({
        variables: { workspaceId, mode },
      });
      const payload = normalizePreference(
        (
          result.data as
            | { setWorkspaceDefaultExperienceMode?: unknown }
            | undefined
        )?.setWorkspaceDefaultExperienceMode,
        workspaceId,
      );
      await refetch({ workspaceId });
      return payload;
    },
    [refetch, setWorkspaceDefaultMutation, workspaceId],
  );

  return {
    workspaceId,
    preference,
    effectiveMode,
    isSimpleMode: effectiveMode === "simple",
    loading,
    error,
    saving: personalSaving || workspaceSaving,
    refresh,
    setPersonalMode,
    setWorkspaceDefaultMode,
  };
}
