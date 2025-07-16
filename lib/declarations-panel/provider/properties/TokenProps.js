import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { without } from "min-dash";
import { TextFieldEntry } from "@bpmn-io/properties-panel";

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

  const currentMarking = element.businessObject.marking || [];
  const listItems = currentMarking.map((token) => (
    {
      id: token.id + '-field',
      label: getTokenValuesString(token),
      entries: token.values.map((tokenValue) => (
        {
          id: token.id + '-' + tokenValue.dataClass.id,
          component: TokenValueProperty,
          tokenValue
        }
      )),
      remove: removeFactory({ element, token, commandStack })
    }
  ))

  return {
    items: listItems,
    add: addFactory({ element, commandStack, customElementFactory }),
  };
}

function TokenValueProperty(props) {
  const { element, tokenValue } = props;
  const commandStack = useService("commandStack");
  const debounce = useService("debounceInput");

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
    commandStack.execute('element.updateProperties', {
      element,
      properties: {
        marking: element.businessObject.marking
      }
    });
  };

  return TextFieldEntry({
    element: tokenValue,
    id: tokenValue.id + "-value",
    label: tokenValue.dataClass.name,
    getValue,
    setValue,
    debounce,
  });
}

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

function addFactory({ element, commandStack, customElementFactory }) {
  return function (event) {
    event.stopPropagation();

    const newToken = createToken(element, customElementFactory);

    commandStack.execute("element.updateProperties", {
      element,
      properties: {
        marking: [...(element.businessObject.marking || []), newToken],
      },
    });
  };
}

function createToken(place, customElementFactory) {
  const initialTokenValues = place.businessObject.color.map((dataClass) => {
    return customElementFactory.create(`${MODELER_PREFIX}:TokenValue`, {
      dataClass,
      // ToDo: Use ID generator here
      value: "x",
    });
  });

  const token = customElementFactory.create(`${MODELER_PREFIX}:Token`, {
    values: initialTokenValues
  });

  initialTokenValues.forEach((value) => {
    value.$parent = token;
  });
  token.$parent = place;

  return token;
}

function getTokenValuesString(token) {
  const valuesString = token.values.map((value) => value.value).join(', ');
  return `(${valuesString})`;
}
