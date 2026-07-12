import { useLangGraphInterrupt } from "@copilotkit/react-core";
import { useState } from "react";
import "./InterruptHandler.css";

export function InterruptHandler() {
  useLangGraphInterrupt({
    render: ({ event, resolve }) => (
      <InterruptPrompt event={event} resolve={resolve} />
    ),
  });
  return null;
}

function InterruptPrompt({
  event,
  resolve,
}: {
  event: any;
  resolve: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const interruptValue = event?.value || {};
  const interruptMessage =
    interruptValue?.question ||
    interruptValue?.message ||
    "The agent needs your input to continue.";

  return (
    <div className="interrupt-card">
      <div className="interrupt-card__header">
        <span className="interrupt-card__icon">💬</span>
        <span className="interrupt-card__title">Maya needs more info</span>
      </div>
      <p className="interrupt-card__message">{interruptMessage}</p>
      <textarea
        className="interrupt-card__input"
        placeholder="Type your response..."
        autoFocus
        rows={5}
        value={draft}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
           return resolve(draft.trim() || "continue");
          }
        }}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="button"
        className="interrupt-card__btn"
        onClick={() => resolve(draft.trim() || "continue")}
      >
        Send Response
      </button>
    </div>
  );
}