import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import { center, getBusinessObject, is } from "../util/Util";
import { remove as collectionRemove } from "diagram-js/lib/util/Collections";
import { getLabel, isLabel, requiresExternalLabel } from "./LabelUtil";
import { assign, forEach } from "min-dash";
import { MODELER_PREFIX, MODELER_DI_PREFIX } from "../util/constants";
import {
  createDefaultInscriptionElementForClass,
  getArcColor,
} from "../declarations-panel/provider/properties/Util";
import { hasUnboundOutputVariables } from "../simulation/binding-utils/bindingUtilsEarlyReturnLogic";

export default class CustomVerification extends CommandInterceptor {
	constructor(eventBus, overlays) {
    super(eventBus);

		this._overlays = overlays;

		this._overlayMap = new Map();

		const self = this;

		
    function verifyStructuralCorrectness(e) {
      self.verifyStructuralCorrectness(self, e.context);
			console.log("Triggered")
    }
    
    self.executed([
      "connection.create",
      "connection.delete",
    ], ifModelElement(verifyStructuralCorrectness));
	}

  verifyStructuralCorrectness = function (self, context) {
    const transition = context.source.type === "ptn:Transition" ? context.source : context.target;

    const [hasUnbound, unboundVars] = hasUnboundOutputVariables(transition.incoming, transition.outgoing);

		console.log("overlayMap before:", self._overlayMap);

    if (self._overlayMap.has(transition)) {
      self._overlays.remove(self._overlayMap.get(transition));
      self._overlayMap.delete(transition);
    }

    if (hasUnbound) {
      console.warn(
      `Transition ${transition.id} has unbound output variables!`,
      );
      let title = "This transition cannot be fired.\n";
      if (unboundVars.length > 0) {
      const varString = unboundVars
        .map(v => {
        const parts = v.split(":");
        let result = parts[1];
        if (parts[2] === "true") {
          result += "[]";
        }
        return result;
        })
        .join(", ");
      title += "Please check unbound output variable(s): " + varString;
      }
      else {
      title += "Please add properties to all Places.";
      }
      const overlayId = self._overlays.add(transition, {
      position: {
        top: 5,
        left: 5,
      },
      html: `
        <div class="unbound-output-overlay" title="${title}" style="cursor: pointer;">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="10" fill="#fff3cd" stroke="#856404" stroke-width="2"/>
          <text x="10" y="15" text-anchor="middle" font-size="16" fill="#856404" font-family="Arial">&#9888;</text>
        </svg>
        </div>
      `
      });
      self._overlayMap.set(transition, overlayId);
    }
		console.log("overlayMap after:", self._overlayMap);
  };
}

CustomVerification.$inject = [
	"eventBus",
  "overlays",
];

// Helpers

function ifModelElement(fn) {
  return function (event) {
    const context = event.context;
    const element = context.shape || context.connection || context.element;

    if (is(element, `${MODELER_PREFIX}:ModelElement`)) {
      fn(event);
    }
  };
}
