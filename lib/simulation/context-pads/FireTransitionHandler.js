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
    console.info(transition);
    const validBindings = getValidInputBindings(transition);
    if (validBindings.length === 0) {
      console.error(
        `Transition ${transition.id} has no valid bindings, cannot trigger`
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
      <div id="bts-fire-overlay" class="bts-fire-overlay" style="background:#fff;padding:10px;border:1px solid rgba(0,0,0,0.12);min-width:260px;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="font-weight:600">Select binding values</div>
          <div class="bts-fire-fields"></div>
          <div style="text-align:right;margin-top:6px;">
            <button class="bts-fire-cancel" style="margin-right:8px;">Cancel</button>
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

    // create form using adapter (attempts to use form-js)
    const form = await createBindingForm(fieldsContainer, vars, valueOptions);
    const overlayId = this._overlays.add(transition, "bts-fire-overlay", {
      // attach to element at its top-left anchor (no negative offset to avoid off-canvas placement)
      position: { top: 0, left: 0 },
      html,
      show: { minZoom: 0.3 },
    });

    // Debug: log overlay and ensure it's visually on top
    try {
      const overlayObj = this._overlays.get(overlayId);
      console.info("fire overlay added", overlayId, overlayObj);
      if (overlayObj && overlayObj.html && overlayObj.html.style) {
        overlayObj.html.style.zIndex = 1500;
      }
    } catch (e) {
      // ignore
    }

    const cleanup = () => {
      try {
        console.info("removing fire overlay", overlayId);
        if (overlayId) this._overlays.remove(overlayId);
      } catch (e) {
        console.warn("failed removing overlay", e);
      }
      // remove keyboard listener
      document.removeEventListener("keydown", keyHandler);
    };

    // keyboard handling
    const keyHandler = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cleanup();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        confirm();
      }
    };
    document.addEventListener("keydown", keyHandler);

    // add a (none) option and wire dynamic filtering between selects
    const selectNodes = Array.from(
      html.querySelectorAll("select.bts-fire-field-select, select")
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

    // build map of possible bindings for quick checks
    // validBindings is an array of binding objects
    function isCompatible(choiceMap, candidateBinding) {
      // choiceMap: { varName: value }
      for (const [k, v] of Object.entries(choiceMap)) {
        if (v === "") continue; // none means no constraint
        if (String(candidateBinding[k]) !== String(v)) return false;
      }
      return true;
    }

    const updateFilters = (changedSelect) => {
      const currentChoices = {};
      selectNodes.forEach((s) => {
        const name =
          s.previousElementSibling && s.previousElementSibling.textContent
            ? s.previousElementSibling.textContent
            : s.getAttribute("data-var");
        currentChoices[name] = s.value;
      });

      // for each select, compute allowed values based on current choices excluding itself
      selectNodes.forEach((s) => {
        const name =
          s.previousElementSibling && s.previousElementSibling.textContent
            ? s.previousElementSibling.textContent
            : s.getAttribute("data-var");

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

        Array.from(allowed).forEach((val) => {
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
    };

    selectNodes.forEach((s) => {
      domEvent.bind(s, "change", () => updateFilters(s));
    });

    // focus first input/select for accessibility
    const firstControl = html.querySelector("select, input");
    if (firstControl) firstControl.focus();

    const confirmBtn = html.querySelector(".bts-fire-confirm");
    const cancelBtn = html.querySelector(".bts-fire-cancel");

    domEvent.bind(cancelBtn, "click", (ev) => {
      ev.preventDefault();
      cleanup();
    });

    const confirm = () => {
      // build binding from form values
      const chosenBinding = form.getValues();

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

    domEvent.bind(confirmBtn, "click", (ev) => {
      ev.preventDefault();
      confirm();
    });
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
