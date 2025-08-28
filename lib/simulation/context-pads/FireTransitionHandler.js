import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import { FIRE_TRANSITION_EVENT } from "../EventHelper";
import { getChildById, getValidInputBindings } from "../Utils";
import {
  removeTokenFromPlace,
  createToken,
} from "../../declarations-panel/provider/properties/Util";
import { event as domEvent, domify } from "min-dom";
import createBindingForm from "./FormJsAdapter";

// Note: we intentionally implement a small, dependency-free form UI here.
// If you want to switch to `form-js` later, we can replace this implementation.

export class FireTransitionHandler extends CommandInterceptor {
  constructor(
    eventBus,
    elementRegistry,
    overlays,
    commandStack,
    customElementFactory,
    identifierService
  ) {
    super(eventBus);
    this._elementRegistry = elementRegistry;
    this._overlays = overlays;
    this.trace = [];
    this.identifierService = identifierService;
    this.commandStack = commandStack;
    this.customElementFactory = customElementFactory;

    eventBus.on(FIRE_TRANSITION_EVENT, (context) => {
      const { element } = context;
      this.fireTransition(element);
      this.trace.push(element);
    });
  }

  fireTransition(transition) {
    this.triggerTransition(transition, false);
  }

  async triggerTransition(transition) {
    const validBindings = getValidInputBindings(transition);
    if (validBindings.length === 0) {
      console.error(
        `Transition ${transition.id} has no valid bindings, cannot fire`
      );
      return;
    }
    // Build a small form: one dropdown per variable (union of keys from bindings)
    const variableNames = new Set();
    validBindings.forEach((b) =>
      Object.keys(b).forEach((k) => variableNames.add(k))
    );
    const vars = Array.from(variableNames);

    const html = domify(`
      <div id="bts-fire-overlay" class="bts-fire-overlay">
        <div class="bts-fire-content">
          <div class="bts-fire-title">Select binding values</div>
          <div class="bts-fire-fields"></div>
          <div class="bts-fire-footer">
            <button class="bts-fire-cancel">Cancel</button>
            <button class="bts-fire-fast">Fire random binding</button>
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

    const cleanup = () => {
      try {
        if (overlayId) this._overlays.remove(overlayId);
      } catch (e) {
        console.warn("Failed removing overlay", e);
      }
      document.removeEventListener("keydown", keyHandler);
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
      fieldsContainer.querySelectorAll("select.bts-fire-field-select, select")
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

    const applyBinding = (chosenBinding) => {
      const { incoming, outgoing } = transition;
      if (incoming) {
        for (const i of incoming) {
          const labels = this.getLabels(i);
          const incomingId = i.businessObject.source.id;
          const source = getChildById(transition.parent, incomingId);
          this.removeTokenFromPlaceForBinding(source, labels, chosenBinding);
        }
      }
      if (outgoing) {
        const enrichedBinding = this.generateValuesForBinding(
          chosenBinding,
          outgoing
        );

        for (const o of outgoing) {
          const inscriptionElements =
            o.businessObject.inscription?.inscriptionElements || [];
          const outgoingId = o.businessObject.target.id;
          const target = getChildById(transition.parent, outgoingId);
          this.addTokenToPlaceForBinding(
            target,
            inscriptionElements,
            chosenBinding,
            enrichedBinding
          );
        }
      }

      cleanup();
    };

    const confirm = () => {
      const chosenBinding = form.getValues();
      applyBinding(chosenBinding);
    };

    const fastFire = () => {
      if (!validBindings || validBindings.length === 0) return;
      const firstBinding = validBindings[0];
      applyBinding(firstBinding);
    };

    domEvent.bind(confirmBtn, "click", (ev) => {
      ev.preventDefault();
      confirm();
    });

    const fastBtn = html.querySelector(".bts-fire-fast");
    if (fastBtn) {
      domEvent.bind(fastBtn, "click", (ev) => {
        ev.preventDefault();
        fastFire();
      });
    }

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
    enrichedBinding
  ) {
    const values = {};
    inscriptionElements.forEach((element, index) => {
      const label = element.variableName;
      const value = element.isGenerated
        ? enrichedBinding[label]
        : binding[label];
      if (value === undefined) {
        console.warn(
          `Value for label "${label}" not found in binding for place ${place.id}.`
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
      values[dataClass.id] = value;
    });
    return values;
  }

  unfireTransition(transition) {
    console.info("Unfiring transition", transition.id);
    // triggerTransition(transition, true);
  }

  getLabels(arc) {
    return (arc.businessObject?.inscription?.inscriptionElements ?? []).map(
      (el) => el.variableName
    );
  }

  generateValuesForBinding(binding, outgoingArcs) {
    const enriched = {};
    const generatedVars = new Map();

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
      enriched[label] = this.identifierService.generateUniqueId(dataClass);
    }

    return { ...binding, ...enriched };
  }

  removeTokenFromPlaceForBinding(place, labels, binding) {
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
      removeTokenFromPlace(place, marking[index], this.commandStack);
    }
  }

  addTokenToPlaceForBinding(
    place,
    inscriptionElements,
    binding,
    enrichedBinding
  ) {
    const values = this.getTokenValueMapFromBinding(
      place,
      inscriptionElements,
      binding,
      enrichedBinding
    );
    createToken(place, values, this.customElementFactory, this.commandStack);
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
