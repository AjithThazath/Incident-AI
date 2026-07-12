import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { CopilotTriggerProvider } from "./components/CopilotKit/CopilotTriggerContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CopilotKit runtimeUrl="/api/copilotkit">
       <CopilotTriggerProvider>
        <App />
      </CopilotTriggerProvider>
    </CopilotKit>
  </React.StrictMode>,
);
