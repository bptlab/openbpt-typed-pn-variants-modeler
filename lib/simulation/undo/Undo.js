import { domify, classes as domClasses, event as domEvent } from "min-dom";

import { RESET_SIMULATION_EVENT } from "../EventHelper";

export default function Undo(eventBus, tokenSimulationPalette, commandStack) {
  this._eventBus = eventBus;
  this._tokenSimulationPalette = tokenSimulationPalette;
  this._commandStack = commandStack;

  this._init();

  // update enabled state when the command stack changes or when the simulation is reset
  eventBus.on("commandStack.changed", () => {
    const canUndo =
      this._commandStack && typeof this._commandStack.canUndo === "function"
        ? this._commandStack.canUndo()
        : true;

    if (canUndo) domClasses(this._paletteEntry).remove("disabled");
    else domClasses(this._paletteEntry).add("disabled");
  });

  eventBus.on(RESET_SIMULATION_EVENT, () => {
    domClasses(this._paletteEntry).add("disabled");
  });
}

Undo.prototype._init = function () {
  this._paletteEntry = domify(`
    <div class="bts-entry disabled" title="Undo">
        <span class="pn-icon-unfire-transition">
    </div>
  `);

  domEvent.bind(this._paletteEntry, "click", () => {
    if (this._commandStack) this._commandStack.undo();
  });

  this._tokenSimulationPalette.addEntry(this._paletteEntry, 1);
};

Undo.$inject = ["eventBus", "tokenSimulationPalette", "commandStack"];
