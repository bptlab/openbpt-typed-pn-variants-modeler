import {
  createToken,
  getTokenValues,
  removeTokenFromPlace,
} from "../../declarations-panel/provider/properties/Util";
import {
  FIRE_TRANSITION_EVENT,
  RESET_SIMULATION_EVENT,
  TOGGLE_MODE_EVENT,
  UNDO_SIMULATION_EVENT,
} from "../EventHelper";

const LOW_PRIORITY = 500;
const HIGH_PRIORITY = 5000;

export default function Simulator(
  eventBus,
  elementRegistry,
  commandStack,
  customElementFactory,
  identifierService
) {
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

  function getInitialObjectIdentifiers() {
    const identifiers = new Set();
    elementRegistry.forEach((element) => {
      if (element.type === "ptn:Place") {
        const marking = element.businessObject.marking || [];
        marking.forEach((token) => {
          identifiers.add(...token.values.map((value) => value.value));
        });
      }
    });
    console.info("Initialized object identifiers:", identifiers);

    return Array.from(identifiers);
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
  // keep local trace; identifiers are managed by identifierService
  this.objectIdentifiers = identifierService.getIdentifiers();

  eventBus.on(RESET_SIMULATION_EVENT, HIGH_PRIORITY, (event) => {
    this.reset();
  });

  eventBus.on(TOGGLE_MODE_EVENT, HIGH_PRIORITY, (event) => {
    const active = event.active;
    if (active) {
      console.info("Set base marking");
      this.basemarking = getCurrentMarking();
      // initialize identifier service with current identifiers
      identifierService.setIdentifiers(getInitialObjectIdentifiers());
      this.objectIdentifiers = identifierService.getIdentifiers();
    } else {
      this.reset();
      this.basemarking = undefined;
    }
  });

  /*
  eventBus.on(FIRE_TRANSITION_EVENT, LOW_PRIORITY, (event) => {
    const { element } = event;
    fireTransition(element);
    this.trace.push(element);
  });

  eventBus.on(UNDO_SIMULATION_EVENT, LOW_PRIORITY, (event) => {
    const element = this.trace.pop();
    unfireTransition(element);
  });
  */
}

Simulator.$inject = [
  "eventBus",
  "elementRegistry",
  "commandStack",
  "customElementFactory",
  "identifierService",
];
