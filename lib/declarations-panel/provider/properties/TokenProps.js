import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { without } from "min-dash";
import { TextFieldEntry } from "@bpmn-io/properties-panel";
import { createToken, getTokenValuesString } from "./Util";

export function TokenProps(props) {
  const { element, injector } = props;

  if (
    !is(element, `${MODELER_PREFIX}:Place`) ||
    !element.businessObject.color ||
    !element.businessObject.color.length
  ) {
    return null;
  }

  const commandStack = injector.get("commandStack");
  const customElementFactory = injector.get("customElementFactory");
  const readOnly = injector.get("simulationModeService").isActive();

  const currentMarking = element.businessObject.marking || [];
  const listItems = currentMarking.map((token) => {
    const tokenListItem = {
      id: token.id + "-field",
      label: getTokenValuesString(token),
      entries: token.values.map((tokenValue) => ({
        id: token.id + "-" + tokenValue.dataClass.id,
        component: TokenValueProperty,
        tokenValue,
      })),
    };

    // Disable removing elements in simulation mode
    if (!readOnly) {
      tokenListItem.remove = removeFactory({ element, token, commandStack });
    }
    return tokenListItem;
  });

  // Disable adding new elements in simulation mode
  if (readOnly) {
    return {
      items: listItems,
    };
  }

  return {
    items: listItems,
    add: addFactory({ element, commandStack, customElementFactory, injector }),
  };
}

function TokenValueProperty(props) {
  const { element, tokenValue } = props;
  const commandStack = useService("commandStack");
  const debounce = useService("debounceInput");
  const readOnly = useService("simulationModeService").isActive();

  const getValue = (tokenValue) => {
    return tokenValue.value;
  };

  const setValue = (value) => {
    commandStack.execute("element.updateModdleProperties", {
      element,
      moddleElement: tokenValue,
      properties: {
        value,
      },
    });

    // This only triggers a re-render, no actual change
    commandStack.execute("element.updateProperties", {
      element,
      properties: {
        marking: element.businessObject.marking,
      },
    });
  };

  return TextFieldEntry({
    element: tokenValue,
    id: tokenValue.id + "-value",
    label: tokenValue.dataClass.name,
    getValue,
    setValue,
    debounce,
    disabled: readOnly,
  });
}

// TODO: Rename element to place
function removeFactory({ element, token, commandStack }) {
  return function (event) {
    event.stopPropagation();

    commandStack.execute("element.updateProperties", {
      element,
      properties: {
        marking: without(element.businessObject.marking, token),
      },
    });
  };
}

// TODO: Rename element to place
function addFactory({ element, commandStack, customElementFactory, injector }) {
  return function (event) {
    event.stopPropagation();

    // Get identifier service from injector (available when provider registered)
    let identifierService = null;
    try {
      identifierService = injector.get("identifierService");
    } catch (e) {
      identifierService = null;
    }

    const values = {};
    element.businessObject.color.forEach((dataClass) => {
      if (
        identifierService &&
        typeof identifierService.generateUniqueId === "function"
      ) {
        values[dataClass.id] = identifierService.generateUniqueId(dataClass);
      } else {
        throw new Error("IdentifierService not available in injector");
      }
    });

    createToken(element, values, customElementFactory, commandStack);
  };
}
