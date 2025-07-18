import {
  createToken,
  getTokenValues,
  removeTokenFromPlace,
} from "../../declarations-panel/provider/properties/Util";
import { MODELER_PREFIX } from "../../util/constants";
import {
  FIRE_TRANSITION_EVENT,
  RESET_SIMULATION_EVENT,
  TOGGLE_MODE_EVENT,
  UNDO_SIMULATION_EVENT,
} from "../EventHelper";
import { getChildById, getValidBindings } from "../Utils";

const LOW_PRIORITY = 500;
const HIGH_PRIORITY = 5000;

function getTokenValueMapFromBinding(place, labels, binding) {
  const values = {};
  labels.forEach((label, index) => {
    if (!binding[label]) {
      console.warn(
        `Binding for label "${label}" not found in provided binding.`
      );
      return;
    }
    const dataClass = place.businessObject.color[index];
    if (!dataClass) {
      console.warn(
        `Data class for label "${label}" not found in place ${place.id}.`
      );
      return;
    }
    values[dataClass.id] = binding[label] || "";
  });
  return values;
}

export default function Simulator(
  eventBus,
  elementRegistry,
  commandStack,
  customElementFactory
) {
  function addTokenToPlaceForBinding(place, labels, binding) {
    const values = getTokenValueMapFromBinding(place, labels, binding);
    createToken(place, values, customElementFactory, commandStack);
  }

  function removeTokenFromPlaceForBinding(place, labels, binding) {
    const marking = place.businessObject.marking || [];
    if (!marking || marking.length === 0) {
      console.warn(`No tokens found in place ${place.id}, cannot remove.`);
      return;
    }
    const index = marking.findIndex((token) => {
      return labels.every(
        (label, i) => token.values[i].value === binding[label]
      );
    });

    if (index !== -1) {
      removeTokenFromPlace(place, marking[index], commandStack);
    }
  }

  function getCurrentMarking() {
    // TODO: Fix reference vs copy issue with current marking
    const marking = new Map();
    elementRegistry.forEach((element) => {
      if (element.type === "ptn:Place") {
        marking.set(
          element.id,
          element.businessObject.marking
            ? element.businessObject.marking.map((token) =>
                getTokenValues(token)
              )
            : []
        );
      }
    });
    return marking;
  }

  function unfireTransition(transition) {
    // triggerTransition(transition, true);
  }

  function fireTransition(transition) {
    triggerTransition(transition, false);
  }

  function getLabels(inscription) {
    if (
      !inscription ||
      !inscription.inscriptionElements ||
      inscription.inscriptionElements.length === 0
    ) {
      console.warn(
        `Incoming arc ${i.id} has no inscription, cannot update marking`
      );
      return [];
    }
    return inscription.inscriptionElements.map(
      (element) => element.variableName
    );
  }

  function triggerTransition(transition) {
    const validBindings = getValidBindings(transition);
    if (validBindings.length === 0) {
      console.error(
        `Transition ${transition.id} has no valid bindings, cannot trigger`
      );
      return;
    }

    const binding = validBindings[0];

    const { incoming, outgoing } = transition;
    if (incoming) {
      for (const i of incoming) {
        const { inscription } = i.businessObject;
        const labels = getLabels(inscription);
        const incomingId = i.businessObject.source.id;
        const source = getChildById(transition.parent, incomingId);
        removeTokenFromPlaceForBinding(source, labels, binding);
      }
    }
    if (outgoing) {
      for (const o of outgoing) {
        const { inscription } = o.businessObject;
        const labels = getLabels(inscription);
        const outgoingId = o.businessObject.target.id;
        const target = getChildById(transition.parent, outgoingId);
        addTokenToPlaceForBinding(target, labels, binding);
      }
    }
  }

  function reset() {
    if (this.basemarking !== undefined) {
      elementRegistry.forEach((element) => {
        if (this.basemarking.has(element.id)) {
          element.businessObject.marking = [];
          commandStack.execute("element.updateProperties", {
            element,
            properties: {
              marking: [],
            },
          });
          this.basemarking.get(element.id).forEach((values) => {
            console.info("Adding token to", element.id, values);
            createToken(element, values, customElementFactory, commandStack);
          });
          console.info("Updated marking for", element.id);
        }
      });
    }
    this.trace = [];
  }

  this.basemarking = undefined;
  this.trace = [];
  this.reset = reset;

  eventBus.on(RESET_SIMULATION_EVENT, HIGH_PRIORITY, (event) => {
    this.reset();
  });

  eventBus.on(TOGGLE_MODE_EVENT, HIGH_PRIORITY, (event) => {
    const active = event.active;
    if (active) {
      console.info("Set base marking");
      this.basemarking = getCurrentMarking();
    } else {
      this.reset();
      this.basemarking = undefined;
    }
  });

  eventBus.on(FIRE_TRANSITION_EVENT, LOW_PRIORITY, (event) => {
    const { element } = event;
    fireTransition(element);
    this.trace.push(element);
  });

  eventBus.on(UNDO_SIMULATION_EVENT, LOW_PRIORITY, (event) => {
    const element = this.trace.pop();
    unfireTransition(element);
  });
}

Simulator.$inject = [
  "eventBus",
  "elementRegistry",
  "commandStack",
  "customElementFactory",
];
