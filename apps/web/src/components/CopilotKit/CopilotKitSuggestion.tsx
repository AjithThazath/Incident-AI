import { useConfigureSuggestions } from "@copilotkit/react-core/v2";

export function StaticSuggestions() {
  useConfigureSuggestions({
    suggestions: [
      { title: "Show me incident 40", message: "Navigate to incident 40" },
      { title: "I am facing an issue", message: "I am facing an issue with db" },
      { title: "Summarize high CPU Usage runbook", message: "Summarize api-gateway   — High CPU Usage Runbook" },
    ],
  });
  return null;
}