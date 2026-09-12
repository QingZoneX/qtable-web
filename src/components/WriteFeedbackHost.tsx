import { message } from "antd";
import { useEffect } from "react";
import { subscribeWriteFeedback } from "../store/writeFeedback";

export function WriteFeedbackHost() {
  useEffect(
    () =>
      subscribeWriteFeedback((event) => {
        if (event.level === "success") {
          message.success(event.message);
          return;
        }
        message.error(event.message);
      }),
    [],
  );

  return null;
}
