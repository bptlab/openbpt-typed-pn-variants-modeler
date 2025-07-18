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

export default function Simulator(
  eventBus,
  elementRegistry,
  moddle,
  customElementFactory
) {
  function addToken(place, labels, binding) {
    const marking = place.businessObject.marking ?? [];
    console.info(marking);
    const token = createToken(place, labels, binding);
    return [...marking, token];
  }

  function removeToken(place, labels, binding) {
    const marking = place.businessObject.marking || [];
    const index = marking.findIndex((token) => {
      return labels.every(
        (label, i) => token.values[i].value === binding[label]
      );
    });

    if (index !== -1) {
      marking.splice(index, 1);
    }

    return marking;
  }

  function createToken(place, labels, binding) {
    const values = labels.map((label, index) =>
      customElementFactory.create(`${MODELER_PREFIX}:TokenValue`, {
        dataClass: place.businessObject.color[index],
        value: binding[label],
      })
    );

    const token = moddle.create(`${MODELER_PREFIX}:Token`, {
      values,
    });

    values.forEach((value) => {
      value.$parent = token;
    });
    token.$parent = place;

    return token;
  }

  function rerenderElement(element) {
    eventBus.fire("element.changed", {
      element,
    });
  }

  function updateMarking(place, newMarking) {
    place.businessObject.marking = newMarking;
    rerenderElement(place);
  }

  function getCurrentMarking() {
    // TODO: Fix reference vs copy issue with current marking
    const marking = new Map();
    elementRegistry.forEach((element) => {
      if (element.type === "ptn:Place") {
        marking.set(
          element.id,
          element.businessObject.marking
            ? JSON.parse(JSON.stringify(element.businessObject.marking))
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
        const newMarking = removeToken(source, labels, binding);
        updateMarking(source, newMarking);
      }
    }
    if (outgoing) {
      for (const o of outgoing) {
        const { inscription } = o.businessObject;
        const labels = getLabels(inscription);
        const outgoingId = o.businessObject.target.id;
        const target = getChildById(transition.parent, outgoingId);
        const newMarking = addToken(target, labels, binding);
        updateMarking(target, newMarking);
      }
    }
  }

  function reset() {
    if (this.basemarking !== undefined) {
      console.info(this.basemarking);
      elementRegistry.forEach((element) => {
        console.info(element.id);
        console.info(this.basemarking.has(element.id));
        if (this.basemarking.has(element.id)) {
          console.info("Updating marking for", element.id);
          updateMarking(element, this.basemarking.get(element.id));
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
  "moddle",
  "customElementFactory",
];
