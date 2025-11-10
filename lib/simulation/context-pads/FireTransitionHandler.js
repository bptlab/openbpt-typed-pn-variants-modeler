import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import {
  FIRE_TRANSITION_EVENT,
  TRANSITION_FIRED_EVENT,
  TOGGLE_MODE_EVENT,
} from "../EventHelper";
import { getChildById } from "../Utils";
import { getValidInputBindings } from "../bindingUtils";
import { event as domEvent, domify } from "min-dom";
import {
  buildAddTokenCommand,
  buildRemoveTokenCommand,
} from "../../declarations-panel/provider/properties/Util";
import { MODELER_PREFIX } from "../../util/constants";
import createBindingForm from "./FormJsAdapter";
import { without } from "min-dash";

export class FireTransitionHandler extends CommandInterceptor {
  constructor(
    eventBus,
    elementRegistry,
    overlays,
    commandStack,
    customElementFactory,
    identifierService,
  ) {
    super(eventBus);
    this._eventBus = eventBus;
    this._elementRegistry = elementRegistry;
    this._overlays = overlays;
    this.identifierService = identifierService;
    this.commandStack = commandStack;
    this.customElementFactory = customElementFactory;

    eventBus.on(FIRE_TRANSITION_EVENT, (context) =>
      this.fireTransition(context),
    );
  }

  async fireTransition(contextOrElement) {
    const context = contextOrElement || {};
    const transition = context.element || contextOrElement;
    const randomRequest = context.random === true;
    // helper to execute a binding without showing the UI (used by context-pad fast-fire)
    const executeBinding = (transitionEl, chosenBinding) => {
      const { incoming, outgoing } = transitionEl;

      const commands = [];
      const placeMarkingUpdates = new Map();

      if (incoming) {
        for (const i of incoming) {
          if (i.businessObject.isInhibitorArc) continue;

          const inscriptionElements =
            i.businessObject.inscription?.inscriptionElements || [];
          const incomingId = i.businessObject.source.id;
          const source = getChildById(transitionEl.parent, incomingId);
          const tokenToRemove = findMatchingToken(
            source,
            inscriptionElements,
            chosenBinding,
          );
          if (tokenToRemove) {
            placeMarkingUpdates.get(source.id) ||
              source.businessObject.marking ||
              [];
            const newMarking = without(currentMarking, tokenToRemove);
            placeMarkingUpdates.set(source.id, newMarking);
          }
        }
      }

      const { enrichedBinding, reservations } = this.generateValuesForBinding(
        chosenBinding,
        outgoing || [],
      );

      if (outgoing) {
        for (const o of outgoing) {
          const inscriptionElements =
            o.businessObject.inscription?.inscriptionElements || [];
          const outgoingId = o.businessObject.target.id;
          const target = getChildById(transitionEl.parent, outgoingId);

          const initialTokenValues = (target.businessObject.color || []).map(
            (dataClass, idx) => {
              const valueForClass = (this.getTokenValueMapFromBinding(
                target,
                inscriptionElements,
                chosenBinding,
                enrichedBinding,
              ) || {})[dataClass.id];
              const tv = this.customElementFactory.create(
                `${MODELER_PREFIX}:TokenValue`,
                {
                  dataClass,
                  value: valueForClass,
                },
              );
              return tv;
            },
          );

          const token = this.customElementFactory.create(
            `${MODELER_PREFIX}:Token`,
            {
              values: initialTokenValues,
            },
          );
          initialTokenValues.forEach((v) => (v.$parent = token));
          token.$parent = target;

          const currentMarking =
            placeMarkingUpdates.get(target.id) ||
            target.businessObject.marking ||
            [];
          const newMarking = [...currentMarking, token];
          placeMarkingUpdates.set(target.id, newMarking);
        }
      }

      // TODO: Check if its the same token with same id
      // Convert place marking updates to commands
      for (const [placeId, newMarking] of placeMarkingUpdates) {
        const place = getChildById(transitionEl.parent, placeId);
        commands.push({
          cmd: "element.updateProperties",
          context: {
            element: place,
            properties: { marking: newMarking },
          },
        });
      }

      const finalCommands = [...commands];

      if (reservations && reservations.length > 0) {
        finalCommands.push({
          cmd: "identifier.commit-reservations",
          context: {
            reservations,
            identifierService: this.identifierService,
          },
        });
      }

      try {
        if (finalCommands.length > 0) {
          this.commandStack.execute(
            "properties-panel.multi-command-executor",
            finalCommands,
          );
          this._eventBus.fire(TRANSITION_FIRED_EVENT, {
            transition: transitionEl,
          });
        }
      } catch (e) {
        console.warn("Failed executing fire transition commands", e);
      }
    };

    let validBindings = getValidInputBindings(transition);
    if (validBindings.length === 0) {
      console.error(
        `Transition ${transition.id} has no valid bindings, cannot fire`,
      );
      return;
    }

    // --- inhibitor arc & output-read filtering ---
    // Build sets of generated variables (from outgoing arcs) and real input variables
    const outgoingArcs = transition.outgoing || [];
    const incomingArcs = transition.incoming || [];

    const generatedVarNames = new Set();
    outgoingArcs.forEach((arc) => {
      const elements =
        arc.businessObject.inscription?.inscriptionElements || [];
      elements.forEach((el) => {
        if (el && el.isGenerated) generatedVarNames.add(el.variableName);
      });
    });

    const realInputVarNames = new Set();
    incomingArcs.forEach((arc) => {
      if (arc.businessObject.isInhibitorArc) return;
      const labels = this.getLabels(arc);
      labels.forEach((l) => realInputVarNames.add(l));
    });

    // helper: test whether a binding is blocked by any inhibitor arc
    const isBlockedByInhibitor = (binding) => {
      for (const arc of incomingArcs) {
        if (!arc.businessObject.isInhibitorArc) continue;

        const elements =
          arc.businessObject.inscription?.inscriptionElements || [];
        if (elements.length === 0) continue;

        const place = arc.source || null;
        if (!place || !place.businessObject) continue;

        // build expected tuple (dataClass.id -> value) for this inhibitor arc
        const expected = {};
        elements.forEach((el, idx) => {
          const label = el.variableName;
          const dataClass = place.businessObject.color?.[idx];
          if (!dataClass) return;
          const value = binding[label];
          if (value === undefined) return; // unconstrained, skip
          expected[dataClass.id] = value;
        });

        // empty expected means this inhibitor arc doesn't constrain this binding
        if (Object.keys(expected).length === 0) continue;

        const marking = place.businessObject.marking || [];
        for (const token of marking) {
          const tokenMap = {};
          (token.values || []).forEach((v) => {
            if (v && v.dataClass && v.dataClass.id)
              tokenMap[v.dataClass.id] = v.value;
          });
          const allMatch = Object.keys(expected).every(
            (k) => String(tokenMap[k]) === String(expected[k]),
          );
          if (allMatch) {
            // inhibitor arc blocks this binding because the place contains the exact tuple
            return true;
          }
        }
      }
      return false;
    };

    // helper: ensure that every output variable that is not generated is read by a real input arc
    const isInvalidDueToOutputs = (binding) => {
      const outputVars = new Set();
      outgoingArcs.forEach((arc) => {
        const elements =
          arc.businessObject.inscription?.inscriptionElements || [];
        elements.forEach((el) => outputVars.add(el.variableName));
      });

      for (const v of outputVars) {
        if (generatedVarNames.has(v)) continue;
        if (!realInputVarNames.has(v)) {
          // this output variable is not provided by any real input arc (only possibly by inhibitor arcs)
          return true;
        }
      }
      return false;
    };

    // Apply filters: inhibitor arcs act as negative constraints and outputs must be backed by real inputs
    validBindings = validBindings.filter(
      (b) => !isBlockedByInhibitor(b) && !isInvalidDueToOutputs(b),
    );

    if (validBindings.length === 0) {
      console.error(
        `Transition ${transition.id} has no valid bindings after inhibitor/output filtering, cannot fire`,
      );
      return;
    }

    // If a random firing was requested, pick a random valid binding and execute immediately
    if (randomRequest) {
      if (validBindings && validBindings.length > 0) {
        const idx = Math.floor(Math.random() * validBindings.length);
        const chosen = validBindings[idx];
        executeBinding(transition, chosen);
      }
      return;
    }
    // Build a small form: one dropdown per variable (union of keys from bindings)
    const variableNames = new Set();
    validBindings.forEach((b) =>
      Object.keys(b).forEach((k) => variableNames.add(k)),
    );
    const vars = Array.from(variableNames);

    const html = domify(`
      <div id="bts-fire-overlay" class="bts-fire-overlay">
        <div class="bts-fire-content">
          <div class="bts-fire-title">Select binding values</div>
          <div class="bts-fire-fields"></div>
          <div class="bts-fire-footer">
            <button class="bts-fire-cancel">Cancel</button>
            <button class="bts-fire-confirm">Fire</button>
          </div>
        </div>
      </div>
    `);

    const fieldsContainer = html.querySelector(".bts-fire-fields");

    // collect possible values per variable from available bindings
    const valueOptions = new Map();
    vars.forEach((v) => valueOptions.set(v, new Set()));
    validBindings.forEach((b) => {
      vars.forEach((v) => {
        if (b[v] !== undefined) valueOptions.get(v).add(String(b[v]));
      });
    });

    const form = await createBindingForm(fieldsContainer, vars, valueOptions);

    // attach overlay now so we can measure label widths
    const overlayId = this._overlays.add(transition, "bts-fire-overlay", {
      position: { top: 0, left: 0 },
      html,
      show: { minZoom: 0.3 },
    });

    // close overlay when simulation mode is toggled off or user clicks outside
    const outsideClickHandler = (ev) => {
      if (!html.contains(ev.target)) {
        cleanup();
      }
    };

    const toggleModeHandler = (evt) => {
      if (!evt.active) cleanup();
    };

    // attach listeners
    document.addEventListener("click", outsideClickHandler);
    try {
      this._eventBus.on &&
        this._eventBus.on(TOGGLE_MODE_EVENT, toggleModeHandler);
    } catch (e) {
      // ignore if event type not used
    }

    const cleanup = () => {
      try {
        if (overlayId) this._overlays.remove(overlayId);
      } catch (e) {
        console.warn("Failed removing overlay", e);
      }
      // remove listeners
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("click", outsideClickHandler);
      try {
        this._eventBus.off &&
          this._eventBus.off(TOGGLE_MODE_EVENT, toggleModeHandler);
      } catch (e) {
        // ignore
      }
    };

    // keyboard handling
    // placeholder for confirm button reference and updater
    let confirmBtn = null;
    let updateConfirmEnabled = () => {};

    const keyHandler = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cleanup();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        // Don't confirm if the button exists and is disabled
        if (confirmBtn && confirmBtn.disabled) return;
        confirm();
      }
    };

    // add a (none) option and wire dynamic filtering between selects
    // scope selects to the overlay fields container to avoid matching global selects
    const selectNodes = Array.from(
      fieldsContainer.querySelectorAll("select.bts-fire-field-select, select"),
    );

    // ensure each select has a (none) option at top
    selectNodes.forEach((s) => {
      // prevent duplicate none option
      if (!Array.from(s.options).some((o) => o.value === "")) {
        const none = document.createElement("option");
        none.value = "";
        none.text = "(none)";
        s.insertBefore(none, s.firstChild);
      }
    });

    // Check whether a binding is compatible with the current choices
    function isCompatible(choiceMap, candidateBinding) {
      // choiceMap: { varName: value }
      for (const [k, v] of Object.entries(choiceMap)) {
        // treat empty/undefined/null as unconstrained
        if (v === "" || v == null) continue;

        if (candidateBinding == null || candidateBinding[k] == null)
          return false;

        const cv = String(candidateBinding[k]).trim();
        const vv = String(v).trim();
        if (cv !== vv) return false;
      }
      return true;
    }

    const updateFilters = (changedSelect) => {
      const currentChoices = {};
      selectNodes.forEach((s) => {
        const name =
          s.getAttribute("data-var") ||
          (s.previousElementSibling && s.previousElementSibling.textContent
            ? s.previousElementSibling.textContent.trim()
            : s.getAttribute("data-var"));
        currentChoices[name] = s.value;
      });

      // for each select, compute allowed values based on current choices excluding itself
      selectNodes.forEach((s) => {
        const name =
          s.getAttribute("data-var") ||
          (s.previousElementSibling && s.previousElementSibling.textContent
            ? s.previousElementSibling.textContent.trim()
            : s.getAttribute("data-var"));

        const allowed = new Set();
        validBindings.forEach((b) => {
          // check compatibility with all other selects (excluding this select)
          const otherChoices = { ...currentChoices };
          delete otherChoices[name];
          if (isCompatible(otherChoices, b)) {
            if (b[name] !== undefined) allowed.add(String(b[name]));
          }
        });

        // rebuild options but preserve current selection if still allowed
        const cur = s.value;
        // remove all non-(none) options
        Array.from(s.options).forEach((opt) => {
          if (opt.value === "") return; // keep none
          opt.remove();
        });

        Array.from(allowed)
          .sort()
          .forEach((val) => {
            const o = document.createElement("option");
            o.value = val;
            o.text = val;
            s.appendChild(o);
          });

        // restore selection if possible
        if (
          cur &&
          (cur === "" || Array.from(s.options).some((o) => o.value === cur))
        ) {
          s.value = cur;
        } else {
          s.value = "";
        }
      });

      // update confirm button state after filters changed
      try {
        updateConfirmEnabled();
      } catch (e) {
        console.warn("Failed to update confirm button state", e);
      }
    };

    // Update filters on each select change
    selectNodes.forEach((s) => {
      domEvent.bind(s, "change", () => updateFilters(s));
    });

    // initialize selections
    if (selectNodes.length > 0) {
      if (validBindings.length === 1) {
        // if there's exactly one valid binding, prefill all fields with its values
        const singleBinding = validBindings[0];
        selectNodes.forEach((s) => {
          const name =
            s.previousElementSibling && s.previousElementSibling.textContent
              ? s.previousElementSibling.textContent
              : s.getAttribute("data-var");
          const val =
            singleBinding[name] !== undefined && singleBinding[name] !== null
              ? String(singleBinding[name])
              : "";
          if (val === "") {
            s.value = "";
            return;
          }

          if (!Array.from(s.options).some((o) => o.value === val)) {
            const o = document.createElement("option");
            o.value = val;
            o.text = val;
            s.appendChild(o);
          }
          s.value = val;
        });
        updateFilters();
      } else {
        // Pick first variable non-empty option, others to none
        const first = selectNodes[0];
        const firstOpt = Array.from(first.options).find((o) => o.value !== "");
        if (firstOpt) first.value = firstOpt.value;
        for (let i = 1; i < selectNodes.length; i++) selectNodes[i].value = "";
        updateFilters();
      }
    }

    // Focus first input/select for accessibility
    const firstControl = html.querySelector("select, input");
    if (firstControl) firstControl.focus();

    // Wire buttons
    confirmBtn = html.querySelector(".bts-fire-confirm");
    const cancelBtn = html.querySelector(".bts-fire-cancel");
    domEvent.bind(cancelBtn, "click", (ev) => {
      ev.preventDefault();
      cleanup();
    });

    // Enable confirm button when all selects have a non-empty value
    updateConfirmEnabled = () => {
      if (!confirmBtn) return;
      const allBound = selectNodes.every((s) => String(s.value) !== "");
      confirmBtn.disabled = !allBound;
    };

    // Initialize confirm button state
    updateConfirmEnabled();

    function findMatchingToken(place, inscriptionElements, binding) {
      const marking = place.businessObject.marking || [];
      if (!marking || marking.length === 0) return null;

      const expected = {};
      inscriptionElements.forEach((el, idx) => {
        const label = el.variableName;
        const dataClass = place.businessObject.color[idx];
        if (!dataClass) return;
        const value = el.isGenerated ? binding[label] : binding[label];
        if (value !== undefined) expected[dataClass.id] = value;
      });

      for (const token of marking) {
        const tokenMap = {};
        (token.values || []).forEach((v) => {
          if (v && v.dataClass && v.dataClass.id)
            tokenMap[v.dataClass.id] = v.value;
        });
        const allMatch = Object.keys(expected).every(
          (k) => String(tokenMap[k]) === String(expected[k]),
        );
        if (allMatch) return token;
      }
      return null;
    }

    const applyBinding = (chosenBinding) => {
      const { incoming, outgoing } = transition;

      const commands = [];

      // removals (skip inhibitor arcs: they are only enablement constraints)
      if (incoming) {
        for (const i of incoming) {
          // inhibitor arcs must not consume tokens
          if (i.businessObject.isInhibitorArc) continue;

          const inscriptionElements =
            i.businessObject.inscription?.inscriptionElements || [];
          const incomingId = i.businessObject.source.id;
          const source = getChildById(transition.parent, incomingId);
          const tokenToRemove = findMatchingToken(
            source,
            inscriptionElements,
            chosenBinding,
          );
          if (tokenToRemove) {
            commands.push(buildRemoveTokenCommand(source, tokenToRemove));
          }
        }
      }

      // prepare generated ids and additions
      const { enrichedBinding, reservations } = this.generateValuesForBinding(
        chosenBinding,
        outgoing || [],
      );

      if (outgoing) {
        for (const o of outgoing) {
          const inscriptionElements =
            o.businessObject.inscription?.inscriptionElements || [];
          const outgoingId = o.businessObject.target.id;
          const target = getChildById(transition.parent, outgoingId);
          const values = this.getTokenValueMapFromBinding(
            target,
            inscriptionElements,
            chosenBinding,
            enrichedBinding,
          );
          // placeholder entry kept out; actual token creation is handled below in additionCommands
          // Instead of constructing the moddle token here (complex), reuse createToken to perform proper creation.
          // We'll execute createToken imperatively but keep reservation commit in the multi-command so undo can revoke.
        }
      }

      // create moddle token objects for additions so they can be included in the multi-command
      const additionCommands = [];
      if (outgoing) {
        for (const o of outgoing) {
          const inscriptionElements =
            o.businessObject.inscription?.inscriptionElements || [];
          const outgoingId = o.businessObject.target.id;
          const target = getChildById(transition.parent, outgoingId);

          // build TokenValue elements for this target place
          const initialTokenValues = (target.businessObject.color || []).map(
            (dataClass, idx) => {
              const valueForClass = (this.getTokenValueMapFromBinding(
                target,
                inscriptionElements,
                chosenBinding,
                enrichedBinding,
              ) || {})[dataClass.id];
              const tv = this.customElementFactory.create(
                `${MODELER_PREFIX}:TokenValue`,
                {
                  dataClass,
                  value: valueForClass,
                },
              );
              return tv;
            },
          );

          const token = this.customElementFactory.create(
            `${MODELER_PREFIX}:Token`,
            {
              values: initialTokenValues,
            },
          );
          initialTokenValues.forEach((v) => (v.$parent = token));
          token.$parent = target;

          additionCommands.push({
            cmd: "element.updateProperties",
            context: {
              element: target,
              properties: {
                marking: [...(target.businessObject.marking || []), token],
              },
            },
          });
          // use builder to create the add-token command descriptor
          additionCommands[additionCommands.length - 1] = buildAddTokenCommand(
            target,
            token,
          );
        }
      }

      // assemble final commands: removals, additions, commit reservations
      const finalCommands = [...commands, ...additionCommands];

      if (reservations && reservations.length > 0) {
        finalCommands.push({
          cmd: "identifier.commit-reservations",
          context: {
            reservations,
            identifierService: this.identifierService,
          },
        });
      }

      // execute all in a single multi-command so undo reverts all
      try {
        if (finalCommands.length > 0) {
          this.commandStack.execute(
            "properties-panel.multi-command-executor",
            finalCommands,
          );

          // emit an event that a transition was actually fired
          this._eventBus.fire(TRANSITION_FIRED_EVENT, { transition });
        }
      } catch (e) {
        console.warn("Failed executing fire transition commands", e);
        // ensure overlay removed on failure
        try {
          cleanup();
        } catch (err) {
          // ignore
        }
      }
      // close the overlay after successful application
      cleanup();
    };

    const confirm = () => {
      const chosenBinding = form.getValues();
      applyBinding(chosenBinding);
    };

    domEvent.bind(confirmBtn, "click", (ev) => {
      ev.preventDefault();
      confirm();
    });

    // if exactly one binding existed and fields were prefilled, focus confirm for quick fire
    try {
      if (validBindings.length === 1 && confirmBtn) confirmBtn.focus();
    } catch (e) {
      // ignore
    }

    // register key handler after buttons wired to avoid race conditions
    document.addEventListener("keydown", keyHandler);
  }

  getTokenValueMapFromBinding(
    place,
    inscriptionElements,
    binding,
    enrichedBinding,
  ) {
    const values = {};
    inscriptionElements.forEach((element, index) => {
      const label = element.variableName;
      const value = element.isGenerated
        ? enrichedBinding[label]
        : binding[label];
      if (value === undefined) {
        console.warn(
          `Value for label "${label}" not found in binding for place ${place.id}.`,
        );
        return;
      }
      const dataClass = place.businessObject.color[index];
      if (!dataClass) {
        console.warn(
          `Data class for label "${label}" not found in place ${place.id}.`,
        );
        return;
      }
      values[dataClass.id] = value;
    });
    return values;
  }

  getLabels(arc) {
    return (arc.businessObject?.inscription?.inscriptionElements ?? []).map(
      (el) => el.variableName,
    );
  }

  generateValuesForBinding(binding, outgoingArcs) {
    const enriched = {};
    const generatedVars = new Map();
    const reservations = [];

    for (const arc of outgoingArcs) {
      const elements =
        arc.businessObject.inscription?.inscriptionElements || [];
      const targetPlace = arc.target;
      elements.forEach((el, i) => {
        if (el.isGenerated && !generatedVars.has(el.variableName)) {
          const dataClass = targetPlace.businessObject.color[i];
          generatedVars.set(el.variableName, dataClass);
        }
      });
    }

    for (const [label, dataClass] of generatedVars.entries()) {
      // reserve identifier, do not commit yet
      try {
        const token = this.identifierService.reserveIdentifier(dataClass);
        reservations.push(token);
        enriched[label] = token.id;
      } catch (e) {
        // fallback to immediate generation
        enriched[label] = this.identifierService.generateUniqueId(dataClass);
      }
    }

    return { enrichedBinding: { ...binding, ...enriched }, reservations };
  }
}

FireTransitionHandler.$inject = [
  "eventBus",
  "elementRegistry",
  "overlays",
  "commandStack",
  "customElementFactory",
  "identifierService",
];
