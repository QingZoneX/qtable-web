const SOURCE_INBOX_OPEN_EVENT = "qtable:source-inbox-open";

export function openSourceInbox() {
  window.dispatchEvent(new Event(SOURCE_INBOX_OPEN_EVENT));
}

export function subscribeSourceInboxOpen(listener: () => void) {
  window.addEventListener(SOURCE_INBOX_OPEN_EVENT, listener);
  return () => window.removeEventListener(SOURCE_INBOX_OPEN_EVENT, listener);
}
