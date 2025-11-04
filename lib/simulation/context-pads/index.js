import ContextPads from "./ContextPads";
import { FireTransitionHandler } from "./FireTransitionHandler";

export default {
  __init__: ["contextPads", "fireTransitionHandler"],
  contextPads: ["type", ContextPads],
  fireTransitionHandler: ["type", FireTransitionHandler],
};
