export type WriteFeedbackLevel = "error" | "success";

export type WriteFeedbackEvent = {
  level: WriteFeedbackLevel;
  message: string;
  operation: string;
  key?: string;
};

type WriteFeedbackListener = (event: WriteFeedbackEvent) => void;

const listeners = new Set<WriteFeedbackListener>();

export const emitWriteFeedback = (event: WriteFeedbackEvent) => {
  for (const listener of listeners) {
    listener(event);
  }
};

export const subscribeWriteFeedback = (listener: WriteFeedbackListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
