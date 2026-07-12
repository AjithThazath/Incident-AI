import { useFrontendTool } from "@copilotkit/react-core/v2";
import { useIncidents } from "../../../hooks/useIncidents";
import { useNavigate } from "react-router-dom";
import z from "zod";

// Define tools in your components
export function useFrontendTools() {
  const navigate = useNavigate();

  useFrontendTool({
    name: "navigate_to_incident",
    description: "Navigate the user to view a specific incident",
    followUp: false,
    parameters: z.object({
      incidentId: z
        .string()
        .describe(
          "The incident ID to which it needs to navigate. Note that incident ID will be in format like INC-0041, INC-0042 etc",
        ),
    }),
    handler: async ({ incidentId }) => {
      navigate(`/incidents/${incidentId}`);
      return `Navigated to ${incidentId}`;
    },
  });
}
