import { create } from "zustand";

import {
  fetchSkillRegistry,
  registerSkill,
  updateSkillStatus,
  type RegisterSkillRequest,
  type SkillCategory,
  type SkillRegistryEntry,
  type SkillStatusUpdateRequest,
} from "../lib/skillSdk";

type SkillRegistryFilters = {
  workspaceId?: string;
  search: string;
  category?: string;
  includeDisabled: boolean;
};

type SkillRegistryState = {
  skills: SkillRegistryEntry[];
  categories: SkillCategory[];
  filters: SkillRegistryFilters;
  selectedSkillId: string | null;
  loading: boolean;
  error: string | null;

  setSearch: (search: string) => void;
  setCategory: (category?: string) => void;
  setWorkspaceId: (workspaceId?: string) => void;
  setIncludeDisabled: (includeDisabled: boolean) => void;
  selectSkill: (skillId: string | null) => void;
  loadSkills: () => Promise<void>;
  refresh: () => Promise<void>;
  createSkill: (request: RegisterSkillRequest) => Promise<SkillRegistryEntry>;
  toggleSkillStatus: (
    skillId: string,
    request: SkillStatusUpdateRequest,
  ) => Promise<SkillRegistryEntry>;
};

export const useSkillRegistryStore = create<SkillRegistryState>((set, get) => ({
  skills: [],
  categories: [],
  filters: {
    workspaceId: undefined,
    search: "",
    category: undefined,
    includeDisabled: false,
  },
  selectedSkillId: null,
  loading: false,
  error: null,

  setSearch: (search) =>
    set((state) => ({
      filters: {
        ...state.filters,
        search,
      },
    })),
  setCategory: (category) =>
    set((state) => ({
      filters: {
        ...state.filters,
        category,
      },
    })),
  setWorkspaceId: (workspaceId) =>
    set((state) => ({
      filters: {
        ...state.filters,
        workspaceId,
      },
    })),
  setIncludeDisabled: (includeDisabled) =>
    set((state) => ({
      filters: {
        ...state.filters,
        includeDisabled,
      },
    })),
  selectSkill: (skillId) => set({ selectedSkillId: skillId }),
  loadSkills: async () => {
    const { filters } = get();
    set({ loading: true, error: null });
    try {
      const result = await fetchSkillRegistry(filters);
      set({
        skills: result.skills,
        categories: result.categories,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load skill registry",
      });
    }
  },
  refresh: async () => {
    await get().loadSkills();
  },
  createSkill: async (request) => {
    const created = await registerSkill(request);
    set((state) => ({
      skills: [created, ...state.skills.filter((item) => item.id !== created.id)],
      selectedSkillId: created.id,
      error: null,
    }));
    await get().refresh();
    return created;
  },
  toggleSkillStatus: async (skillId, request) => {
    const updated = await updateSkillStatus(skillId, request);
    set((state) => ({
      skills: state.skills.map((item) => (item.id === updated.id ? updated : item)),
      error: null,
    }));
    return updated;
  },
}));
