const {
  CopilotRuntime,
  createCopilotExpressHandler,
} = require("@copilotkit/runtime/v2");
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
// import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { LangGraphHttpAgent } from "@ag-ui/langgraph";

  const runtime = new CopilotRuntime({
    agents: {
      default: new LangGraphHttpAgent({
        url: `/api/invokeGraph`
      }),
    },
  });


const handler = createCopilotExpressHandler({
  runtime,
  basePath: "/",
  cors: false,
  mode: "single-route",
});

export { handler };
