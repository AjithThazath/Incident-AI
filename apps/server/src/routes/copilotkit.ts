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
        url: "http://localhost:3001/api/invokeGraph"
      }),
    },
  });
  // const runtime = new CopilotRuntime({
  //   agents: {
  //     default: new LangGraphAgent({
  //       deploymentUrl: "http://localhost:2024",
  //       graphId: "orchestrator",
  //     }),
  //   },
  // });


const handler = createCopilotExpressHandler({
  runtime,
  basePath: "/",
  cors: false,
  mode: "single-route",
});

export { handler };
