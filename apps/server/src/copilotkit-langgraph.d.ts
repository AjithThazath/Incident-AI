declare module "@copilotkit/runtime/langgraph" {
  import { AbstractAgent } from "@ag-ui/client";

  export class LangGraphAgent extends AbstractAgent {
    constructor(config: {
      deploymentUrl: string;
      graphId: string;
      langsmithApiKey?: string;
      description?: string;
    });
  }
}
