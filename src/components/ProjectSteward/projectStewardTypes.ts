export type ProjectStewardEvidence = {
  tableId: string;
  recordId: string;
  title: string;
  deepLink: string;
};

export type ProjectStewardConclusion = {
  id: string;
  kind: "fact" | "inference" | "suggestion" | string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info" | string;
  title: string;
  detail: string;
  evidence: ProjectStewardEvidence[];
  metric?: Record<string, unknown>;
};

export type ProjectStewardSnapshot = {
  capturedAt: string;
  fingerprint: string;
  visibleRecordCount: number;
  tableIds: string[];
  truncated: boolean;
  isStale: boolean;
};

export type ProjectStewardResult = {
  diagnosisId: string;
  traceId: string;
  question: string;
  answer: string;
  generatedAt: string;
  snapshot: ProjectStewardSnapshot;
  facts: ProjectStewardConclusion[];
  inferences: ProjectStewardConclusion[];
  suggestions: ProjectStewardConclusion[];
  diagnostics: Record<string, unknown>;
  ranking: string[];
  provider: string;
  model?: string | null;
  readOnly: boolean;
};

export type ProjectStewardDiagnosisStatus = {
  diagnosisId: string;
  createdAt?: string | null;
  isStale: boolean;
  staleReason?: string | null;
  currentSnapshot?: ProjectStewardSnapshot | null;
  result?: ProjectStewardResult | null;
};
