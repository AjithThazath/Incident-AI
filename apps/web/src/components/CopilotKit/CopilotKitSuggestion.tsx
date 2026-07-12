import { useConfigureSuggestions } from "@copilotkit/react-core/v2";

export function StaticSuggestions() {
  useConfigureSuggestions({
    suggestions: [
      { title: "Show me incident 40", message: "Navigate to incident 40" },
      { title: "I am facing an issue", message: "I am facing an issue with db" },
      { title: "Summarize analytics-engine  Cache Thrashing", message: "Summarize analytics-engine — Cache Thrashing Runbook" },
    ],
  });
  return null;
}