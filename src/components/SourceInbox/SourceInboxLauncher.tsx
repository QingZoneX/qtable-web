import { useEffect, useState } from "react";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import { SourceInboxModal } from "./SourceInboxModal";
import { subscribeSourceInboxOpen } from "./sourceInboxEvents";

export function SourceInboxLauncher() {
  const [open, setOpen] = useState(false);
  const workspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);

  useEffect(() => subscribeSourceInboxOpen(() => setOpen(true)), []);

  if (!workspaceId) return null;

  return (
    <SourceInboxModal
      open={open}
      workspaceId={workspaceId}
      onClose={() => setOpen(false)}
    />
  );
}
