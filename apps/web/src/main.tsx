import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { CopilotTriggerProvider } from "./components/CopilotKit/CopilotTriggerContext";

const API_BASE = import.meta.env.VITE_API_URL || '';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CopilotKit runtimeUrl={`${API_BASE}/api/copilotkit`}>
       <CopilotTriggerProvider>
        <App />
      </CopilotTriggerProvider>
    </CopilotKit>
  </React.StrictMode>,
);
