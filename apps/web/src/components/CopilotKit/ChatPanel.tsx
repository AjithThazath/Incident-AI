import { useState, useEffect } from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { useLangGraphInterrupt } from "@copilotkit/react-core";
import { AgentStepsRenderer } from "./AgentStepsRenderer/AgentStepsRenderer";
import "./ChatPanel.css";
import { useFrontendTools } from "./FrontendTools/useFrontendTools";
import { ToolRenderers } from "./ToolRenderers";
import { StaticSuggestions } from "./CopilotKitSuggestion";
import { useCopilotTrigger } from "./CopilotTriggerContext";
import { InterruptHandler } from "./InterruptHandler/InterruptHandler";

export default function ChatPanel({ mobile = false }: { mobile?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isOpen, setIsOpen } = useCopilotTrigger();

  // Sync trigger context (e.g. "Analyze with AI") into local mobile state
  useEffect(() => {
    if (isOpen) {
      setMobileOpen(true);
    }
  }, [isOpen]);

  const closeMobile = () => {
    setMobileOpen(false);
    setIsOpen(false);
  };

  useFrontendTools();

  // Desktop instance: render the always-visible sidebar panel
  if (!mobile) {
    return (
      <aside className="chat-panel">
        <div className="chat-panel__header">
          <span className="chat-panel__title">
            <MayaHeadsetIcon /> Ask Maya
          </span>
        </div>
        <div className="chat-panel__body">
          <AgentStepsRenderer />
          <InterruptHandler />
          <ToolRenderers />
          <CopilotChat
            labels={{ chatInputPlaceholder: "Ask about an incident..." }}
          />
        </div>
      </aside>
    );
  }

  // Mobile instance: FAB + popup overlay
  return (
    <div className="chat-panel-mobile-wrapper">
      <button
        className="chat-panel__mobile-toggle"
        onClick={() => {
          if (mobileOpen) {
            closeMobile();
          } else {
            setMobileOpen(true);
            setIsOpen(true);
          }
        }}
        aria-label="Toggle chat"
      >
        {mobileOpen ? "✕" : "💬"}
      </button>
      <aside className={`chat-panel ${mobileOpen ? "chat-panel--open" : ""}`}>
        <div className="chat-panel__header">
          <span className="chat-panel__title">
            <MayaHeadsetIcon /> Ask Maya
          </span>
          <button
            className="chat-panel__mobile-close"
            onClick={closeMobile}
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
        <div className="chat-panel__body">
          <AgentStepsRenderer />
          <InterruptHandler />
          <ToolRenderers />
          <CopilotChat
            labels={{ chatInputPlaceholder: "Ask about an incident..." }}
          />
          <StaticSuggestions />
        </div>
      </aside>
    </div>
  );
}

function MayaHeadsetIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M32 8c-11.6 0-21 9.4-21 21v7c0 2.8 2.2 5 5 5h3V28h-3c-.6 0-1.2.1-1.8.3C15.1 18.5 22.8 12 32 12s16.9 6.5 17.8 16.3c-.6-.2-1.2-.3-1.8-.3h-3v13h3c2.8 0 5-2.2 5-5v-7c0-11.6-9.4-21-21-21Z" />
      <path d="M22 26c2.8-5.3 8-8 10-8s7.2 2.7 10 8c-1.8 5.7-4.8 10.3-10 13-5.2-2.7-8.2-7.3-10-13Z" />
      <path d="M18 27h5v16h-5c-1.7 0-3-1.3-3-3V30c0-1.7 1.3-3 3-3Zm23 0h5c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3h-5V27Z" />
      <path d="M43 41c0 6.1-4.9 11-11 11h-4c-3.9 0-7-3.1-7-7v-1h22v-3h6v4c0 4.4-3.6 8-8 8h-1.4c-1.8 2.4-4.7 4-8 4h-4c-1.1 0-2-.9-2-2s.9-2 2-2h4c4.6 0 8.4-3.3 9.3-7.7.1-.4.1-.9.1-1.3Z" />
      <path d="M20 56c0-6.6 5.4-12 12-12s12 5.4 12 12H20Z" />
    </svg>
  );
}
