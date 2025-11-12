import ToggleSimulationMode from "./ToggleSimulationMode";
import DisableModeling from "./DisableModeling";

export default {
  __init__: ["toggleSimulationMode", "disableModeling"],
  toggleSimulationMode: ["type", ToggleSimulationMode],
  disableModeling: ["type", DisableModeling],
};
