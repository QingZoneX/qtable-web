import fs from "node:fs";
import { ciDefinitionsHere } from "./ciOwnership.mjs";

// The browser release-gate harness (`e2e/`) and the CI definitions are
// maintained only in the public repository. The private development checkout
// keeps frozen reference copies of the harness and no workflows at all, so the
// assertions about those surfaces cannot be evaluated here — they are skipped
// instead of either failing on a missing file or silently validating a stale
// copy. In the public repository every assertion stays enforced.
const ciOwned = ciDefinitionsHere();

const apiPath = "src/components/SmartTable/attachments/attachmentApi.ts";
const editorPath = "src/components/SmartTable/editors/AttachmentEditor.tsx";
const rendererPath = "src/components/SmartTable/renderers/renderAttachment.tsx";
const browserGatePath = "e2e/run_attachment_release_gate.py";
const editorGatePath = "e2e/run_attachment_editor_release_gate.py";
const purgeGatePath = "e2e/verify_attachment_cleanup.py";
const contractServerPath = "e2e/attachment_contract_server.py";
const fullStackWorkflowPath = ".github/workflows/full-stack-release-e2e.yml";
const browserContractWorkflowPath = ".github/workflows/attachment-browser-contract.yml";
const api = fs.readFileSync(apiPath, "utf8");
const editor = fs.readFileSync(editorPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");
const browserGate = ciOwned ? fs.readFileSync(browserGatePath, "utf8") : null;
const editorGate = ciOwned ? fs.readFileSync(editorGatePath, "utf8") : null;
const purgeGate = ciOwned ? fs.readFileSync(purgeGatePath, "utf8") : null;
const contractServer = ciOwned ? fs.readFileSync(contractServerPath, "utf8") : null;
const fullStackWorkflow = ciOwned ? fs.readFileSync(fullStackWorkflowPath, "utf8") : null;
const browserContractWorkflow = ciOwned ? fs.readFileSync(browserContractWorkflowPath, "utf8") : null;
const combined = `${api}\n${editor}\n${renderer}`;

const requireText = (text, needle, label) => {
  if (!text.includes(needle)) {
    throw new Error(`[attachment-contract] missing ${label}: ${needle}`);
  }
};

const forbid = (needle, label) => {
  if (combined.includes(needle)) {
    throw new Error(`[attachment-contract] forbidden ${label}: ${needle}`);
  }
};

const forbidWorkflow = (needle, label) => {
  if (fullStackWorkflow.includes(needle)) {
    throw new Error(`[attachment-contract] forbidden full-stack ${label}: ${needle}`);
  }
};

requireText(api, "attachmentId: string", "stable attachment id");
requireText(api, "objectKey: string", "stable object key");
requireText(api, 'headers.set("Authorization", `Bearer ${token}`)', "authenticated attachment requests");
requireText(api, "/api/attachments/tables/", "table/record/field scoped upload endpoint");
requireText(api, 'method: "DELETE"', "real backend delete");
requireText(api, 'cache: "no-store"', "private download cache policy");
requireText(editor, "currentTableId", "table scope resolution");
requireText(editor, "getRecordByCell", "record scope resolution");
requireText(editor, "getBodyField", "field scope resolution");
requireText(editor, "storageCleanup", "pending cleanup disclosure");
requireText(editor, "SAFE_INLINE_IMAGE_TYPES", "allowlisted inline image MIME policy");
requireText(editor, "actualType === declaredType", "declared/actual MIME match");
requireText(editor, 'declaredType === "application/pdf" && actualType === "application/pdf"', "strict PDF preview MIME check");
requireText(editor, 'sandbox=""', "sandboxed PDF preview");
requireText(editor, "mutationLockRef", "synchronous attachment mutation lock");
requireText(editor, "disabled={!scope || mutationInFlight}", "serialized mutation controls");
requireText(renderer, "stableAttachments(args.value)", "stable renderer contract");

if (ciOwned) {
  requireText(browserGate, "input[type='email']", "credential-free browser login path");
  requireText(browserGate, "UpdateRecord", "credential-free permission transition");
  requireText(editorGate, "open_attachment_editor", "real AttachmentEditor cell interaction");
  requireText(editorGate, "input[type='file']", "real AttachmentEditor file input");
  requireText(editorGate, "browser.send_keys(file_input", "WebDriver file upload through editor");
  requireText(editorGate, "browser.refresh()", "persistence across document reload");
  requireText(editorGate, "Preview browser-release-gate.txt", "real editor preview interaction");
  requireText(editorGate, ".ant-modal-footer button", "real editor download interaction");
  requireText(editorGate, "real attachment download response", "real editor download response observation");
  requireText(editorGate, 'bob_download["body"] == PAYLOAD', "downloaded byte verification");
  requireText(editorGate, "UpdateRecord", "dynamic row permission transition");
  requireText(editorGate, "RecycleBin", "recycle visibility check");
  requireText(editorGate, "RestoreRecord", "restore lifecycle check");
  requireText(editorGate, "PurgeRecord", "permanent purge lifecycle check");
  requireText(purgeGate, "AttachmentObject", "registry purge verification");
  requireText(purgeGate, "stat_object", "physical object purge verification");
  requireText(contractServer, "parse_multipart", "browser contract upload handling");
  requireText(contractServer, "private, no-store", "browser contract private download semantics");
  requireText(fullStackWorkflow, "repository: QingZoneX/qtable-server", "public QTable source checkout");
  requireText(fullStackWorkflow, "QTABLE_SERVER_REVISION", "single-source pinned backend revision");
  requireText(fullStackWorkflow, 'tags: ["v*"]', "release-only full-stack trigger");
  requireText(fullStackWorkflow, "docker compose up -d --build", "canonical full-stack startup");
  requireText(fullStackWorkflow, "Run attachment upload refresh permission recycle purge lifecycle", "real editor full-stack browser gate");
  requireText(fullStackWorkflow, "run_attachment_editor_release_gate.py", "full-stack editor script wiring");
  requireText(fullStackWorkflow, "Verify registry and physical object purge", "post-purge reality gate");
  requireText(browserContractWorkflow, "Start real QTableUI development server", "credential-free real UI server");
  requireText(browserContractWorkflow, "Run Chrome attachment lifecycle contract", "credential-free Chrome gate");
}

forbid('/api/attachments/upload', "legacy unscoped upload endpoint");
forbid("presigned", "presigned URL persistence");
forbid("att.url", "persisted attachment URL rendering");
forbid("attachment.url", "persisted attachment URL rendering");
forbid('attachment.name.toLowerCase().endsWith(".pdf")', "extension-driven inline PDF preview");

if (ciOwned) {
  forbidWorkflow("CROSS_REPO_TOKEN", "long-lived cross-repository token bootstrap");
  forbidWorkflow("repository: QingZoneX/QTable", "private sibling checkout requiring a PAT");
  forbidWorkflow("QTABLE_REPO_TOKEN", "QTable repository PAT secret dependency");
  forbidWorkflow("GH_PAT", "generic PAT secret dependency");
}

console.log(
  ciOwned
    ? "[attachment-contract] stable private attachment contract + real editor/full-stack gates OK"
    : "[attachment-contract] stable private attachment contract OK; release-gate harness and workflow assertions skipped (they are maintained in the public repository)",
);
