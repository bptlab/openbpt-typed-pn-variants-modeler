import BaseModeling from "diagram-js/lib/features/modeling/Modeling";
import UpdateLabelHandler from "./UpdateLabelHandler";
import UpdatePropertiesHandler from "./UpdatePropertiesHandler";
import UpdateModdlePropertiesHandler from "./UpdateModdlePropertiesHandler";

export default class CustomModeling extends BaseModeling {
  constructor(eventBus, elementFactory, commandStack) {
    super(eventBus, elementFactory, commandStack);
  }

  updateLabel(element, newLabel, newBounds, hints) {
    this._commandStack.execute("element.updateLabel", {
      element: element,
      newLabel: newLabel,
      newBounds: newBounds,
      hints: hints || {},
    });
  }

  updateProperties(element, properties, hints) {
    this._commandStack.execute("element.updateProperties", {
      element: element,
      properties: properties,
      hints: hints || {},
    });
  }

  updateModdleProperties(element, moddleElement, properties) {
    this._commandStack.execute("element.updateModdleProperties", {
      element: element,
      moddleElement: moddleElement,
      properties: properties,
    });
  }

  getHandlers() {
    const handlers = super.getHandlers.call(this);
    handlers["element.updateLabel"] = UpdateLabelHandler;
    handlers["element.updateProperties"] = UpdatePropertiesHandler;
    handlers["element.updateModdleProperties"] = UpdateModdlePropertiesHandler;
    return handlers;
  }
}

CustomModeling.$inject = ["eventBus", "elementFactory", "commandStack"];
