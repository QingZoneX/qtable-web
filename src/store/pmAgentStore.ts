import { create } from "zustand";
import type {
  PMPhase,
  PMPhaseStatus,
  PMAgentPhaseInfo,
  PMAgentEvent,
  PMAgentRunRequest,
} from "../lib/pmAgent";
import {
  PM_PHASE_ORDER,
  runPMAgent,
  getPMAgentStatus,
} from "../lib/pmAgent";

export type PMAgentWorkflowState = {
  workflowId: string;
  status: "idle" | "running" | "completed" | "failed" | "awaiting_approval";
  message: string;
  phaseSequence: PMPhase[];
  currentPhase: PMPhase | null;
  completedPhases: number;
  totalPhases: number;
  phaseResults: PMAgentPhaseInfo[];
  finalResponse: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

type PMAgentStore = {
  workflows: PMAgentWorkflowState[];
  currentWorkflow: PMAgentWorkflowState | null;
  streamingContent: string;

  startWorkflow: (request: PMAgentRunRequest) => Promise<string>;
  getWorkflow: (workflowId: string) => PMAgentWorkflowState | undefined;
  updateWorkflowFromEvent: (event: PMAgentEvent) => void;
  setCurrentWorkflow: (workflowId: string | null) => void;
  resetCurrentWorkflow: () => void;
  appendStreamContent: (content: string) => void;
  resetStreamContent: () => void;
  refreshWorkflow: (workflowId: string) => Promise<void>;
};

function createInitialState(
  workflowId: string,
  message: string,
  phaseSequence: PMPhase[] = PM_PHASE_ORDER,
): PMAgentWorkflowState {
  return {
    workflowId,
    status: "running",
    message,
    phaseSequence,
    currentPhase: null,
    completedPhases: 0,
    totalPhases: phaseSequence.length,
    phaseResults: phaseSequence.map((phase) => ({
      phase,
      status: "pending" as PMPhaseStatus,
    })),
    finalResponse: "",
    error: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const usePMAgentStore = create<PMAgentStore>((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  streamingContent: "",

  startWorkflow: async (request: PMAgentRunRequest) => {
    const workflowId = `pm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const newState = createInitialState(workflowId, request.message);

    set((state) => ({
      workflows: [newState, ...state.workflows],
      currentWorkflow: newState,
      streamingContent: "",
    }));

    runPMAgent(request, (event) => {
      get().updateWorkflowFromEvent(event);
    }).catch((err) => {
      set((state) => {
        const current = state.currentWorkflow;
        if (current && current.workflowId === workflowId) {
          const next: PMAgentWorkflowState = {
            ...current,
            status: "failed",
            error: err.message,
            updatedAt: new Date().toISOString(),
          };
          return {
            currentWorkflow: next,
            workflows: state.workflows.map((w) =>
              w.workflowId === workflowId ? next : w,
            ),
          };
        }
        return state;
      });
    });

    return workflowId;
  },

  getWorkflow: (workflowId: string) => {
    return get().workflows.find((w) => w.workflowId === workflowId);
  },

  updateWorkflowFromEvent: (event: PMAgentEvent) => {
    set((state) => {
      const workflowId = event.workflowId;
      const existing = state.workflows.find((w) => w.workflowId === workflowId);

      if (!existing) {
        const newState = createInitialState(workflowId, "");
        const updated = applyEvent(newState, event);
        const workflows = [updated, ...state.workflows];
        return {
          workflows,
          currentWorkflow:
            state.currentWorkflow?.workflowId === workflowId
              ? updated
              : state.currentWorkflow,
          streamingContent:
            state.currentWorkflow?.workflowId === workflowId
              ? state.streamingContent + JSON.stringify(event.data) + "\n"
              : state.streamingContent,
        };
      }

      const updated = applyEvent(existing, event);
      return {
        workflows: state.workflows.map((w) =>
          w.workflowId === workflowId ? updated : w,
        ),
        currentWorkflow:
          state.currentWorkflow?.workflowId === workflowId
            ? updated
            : state.currentWorkflow,
        streamingContent:
          state.currentWorkflow?.workflowId === workflowId
            ? state.streamingContent + JSON.stringify(event.data) + "\n"
            : state.streamingContent,
      };
    });
  },

  setCurrentWorkflow: (workflowId: string | null) => {
    if (!workflowId) {
      set({ currentWorkflow: null });
      return;
    }
    const workflow = get().workflows.find((w) => w.workflowId === workflowId);
    if (workflow) {
      set({ currentWorkflow: workflow });
    }
  },

  resetCurrentWorkflow: () => {
    set({ currentWorkflow: null, streamingContent: "" });
  },

  appendStreamContent: (content: string) => {
    set((state) => ({ streamingContent: state.streamingContent + content }));
  },

  resetStreamContent: () => {
    set({ streamingContent: "" });
  },

  refreshWorkflow: async (workflowId: string) => {
    try {
      const status = await getPMAgentStatus(workflowId);
      set((state) => {
        const existing = state.workflows.find((w) => w.workflowId === workflowId);
        const updated: PMAgentWorkflowState = {
          workflowId: status.workflowId,
          status: status.status as PMAgentWorkflowState["status"],
          message: existing?.message || "",
          phaseSequence: status.phaseSequence,
          currentPhase: status.pmPhase || null,
          completedPhases: status.completedPhases,
          totalPhases: status.totalPhases,
          phaseResults: status.phaseResults,
          finalResponse: status.finalResponse || "",
          error: status.error ? JSON.stringify(status.error) : "",
          createdAt: status.createdAt || "",
          updatedAt: status.updatedAt || "",
        };
        return {
          workflows: state.workflows.map((w) =>
            w.workflowId === workflowId ? updated : w,
          ),
          currentWorkflow:
            state.currentWorkflow?.workflowId === workflowId
              ? updated
              : state.currentWorkflow,
        };
      });
    } catch {
      // silently fail
    }
  },
}));

function applyEvent(
  state: PMAgentWorkflowState,
  event: PMAgentEvent,
): PMAgentWorkflowState {
  const data = event.data || {};
  const next = { ...state, updatedAt: new Date().toISOString() };

  switch (event.type) {
    case "pm_agent_started":
      next.status = "running";
      break;

    case "pm_phase_update": {
      const phase = data.pmPhase as PMPhase | undefined;
      const phaseResults = data.latestPhaseResult as PMAgentPhaseInfo | undefined;
      const completedPhases = data.completedPhases as number | undefined;

      if (phase) next.currentPhase = phase;
      if (completedPhases !== undefined) next.completedPhases = completedPhases;
      if (data.totalPhases !== undefined) next.totalPhases = data.totalPhases as number;

      if (phaseResults) {
        next.phaseResults = next.phaseResults.map((pr) =>
          pr.phase === phaseResults.phase ? phaseResults : pr,
        );
      }
      break;
    }

    case "pm_agent_completed":
      next.status = "completed";
      if (data.finalResponse) next.finalResponse = data.finalResponse as string;
      if (data.completedPhases !== undefined) next.completedPhases = data.completedPhases as number;
      if (data.phaseResults) next.phaseResults = data.phaseResults as PMAgentPhaseInfo[];
      break;

    case "pm_agent_failed":
      next.status = "failed";
      if (data.error) next.error = JSON.stringify(data.error);
      break;

    case "requires_approval":
      next.status = "awaiting_approval";
      break;
  }

  return next;
}
