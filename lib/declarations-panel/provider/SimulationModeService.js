import { TOGGLE_MODE_EVENT } from "../../simulation/EventHelper";

export default function SimulationModeService(eventBus) {
  // internal state
  let active = false;

  // public API
  this.isActive = function () {
    return active;
  };

  eventBus.on(TOGGLE_MODE_EVENT, function (event) {
    active = !!event.active;
  });
}

SimulationModeService.$inject = ["eventBus"];
