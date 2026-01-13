import { useQueryStates } from "nuqs";
import { workflowParams } from "../params";

export const useWorkflowsParams = () => {
  return useQueryStates(workflowParams, {
    history: 'push',
    shallow: false
  });
};
