import DeclarationsProvider from "./DeclarationsProvider";
import IdentifierService from "./IdentifierService";
import SimulationModeService from "./SimulationModeService";

export default {
  __init__: [
    "declarationsProvider",
    "identifierService",
    "simulationModeService",
  ],
  declarationsProvider: ["type", DeclarationsProvider],
  identifierService: ["type", IdentifierService],
  simulationModeService: ["type", SimulationModeService],
};
