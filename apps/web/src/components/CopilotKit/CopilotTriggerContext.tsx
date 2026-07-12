// src/context/CopilotTriggerContext.tsx
import { createContext, useContext, useState, useCallback } from "react";

interface CopilotTriggerState {
  isOpen: boolean;
  pendingMessage: string | null;
  openWithMessage: (msg: string) => void;
  clearPending: () => void;
  setIsOpen: (open: boolean) => void;
}

const CopilotTriggerContext = createContext<CopilotTriggerState>({
  isOpen: false,
  pendingMessage: null,
  openWithMessage: () => {},
  clearPending: () => {},
  setIsOpen: () => {},
});

export const useCopilotTrigger = () => useContext(CopilotTriggerContext);

export function CopilotTriggerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const openWithMessage = useCallback((msg: string) => {
    setPendingMessage(msg);
    setIsOpen(true);
  }, []);

  const clearPending = useCallback(() => setPendingMessage(null), []);

  return (
    <CopilotTriggerContext.Provider value={{ isOpen, pendingMessage, openWithMessage, clearPending, setIsOpen }}>
      {children}
    </CopilotTriggerContext.Provider>
  );
}