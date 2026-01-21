import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import { is } from "../util/Util";
import { MODELER_PREFIX, MODELER_DI_PREFIX } from "../util/constants";
import { hasUnboundOutputVariables } from "../simulation/binding-utils/bindingUtilsEarlyReturnLogic";

export default class CustomVerification extends CommandInterceptor {
	constructor(eventBus, overlays, elementRegistry) {
    super(eventBus);

		this._overlays = overlays;
		this._elementRegistry = elementRegistry;
		this._overlayMap = new Map();
		const self = this;

		function verifyInitially(e) {
			const allTransitions = [];
			const elements = self._elementRegistry?._elements
			if (!elements) return;
			
			Object.values(elements).forEach((id) => {
				if (is(id.element, `${MODELER_PREFIX}:Transition`)) {
					allTransitions.push(id.element);
				}
			});
			for (const transition of allTransitions) {
				self.verifyStructuralCorrectness(self, transition);
			}
		}

		eventBus.on("import.done", verifyInitially);

    function verifyAfterConnectionUpdate(e) {
			let contextArc = e.context;

			for (let i=0; i<2; i++) {
				if (contextArc.source?.type !== `${MODELER_PREFIX}:Transition` && contextArc.target?.type !== `${MODELER_PREFIX}:Transition`) {
          if (i === 0)
            contextArc = contextArc.connection;
          else
            return;
				}
				else
					break;
			}
			const transition = contextArc.source.type === `${MODELER_PREFIX}:Transition` ? contextArc.source : contextArc.target;
			
			self.verifyStructuralCorrectness(self, transition);
    }

		self.executed([
			"connection.create",
			"connection.delete",
		], ifModelElement(verifyAfterConnectionUpdate));
		self.reverted([
			"connection.create",
			"connection.delete",
		], ifModelElement(verifyAfterConnectionUpdate));


		function verifyAfterElementUpdate(e) {			
			let contextArc = e.context.element;
			if (!contextArc?.type || contextArc.type !== `${MODELER_PREFIX}:Arc`) return;

			const transition = contextArc.source.type === `${MODELER_PREFIX}:Transition` ? contextArc.source : contextArc.target;
			self.verifyStructuralCorrectness(self, transition);
    }

		self.executed([
			"element.updateModdleProperties",
			"element.updateProperties",
		], ifModelElement(verifyAfterElementUpdate));
		self.reverted([
			"element.updateModdleProperties",
			"element.updateProperties",
		], ifModelElement(verifyAfterElementUpdate));
	}

  verifyStructuralCorrectness = function (self, transition) {
    const [hasUnbound, unboundVars] = hasUnboundOutputVariables(transition.incoming, transition.outgoing);

    if (self._overlayMap.has(transition)) {
      self._overlays.remove(self._overlayMap.get(transition));
      self._overlayMap.delete(transition);
    }

    if (hasUnbound) {
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
  };
}

CustomVerification.$inject = [
	"eventBus",
  "overlays",
	"elementRegistry",
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
