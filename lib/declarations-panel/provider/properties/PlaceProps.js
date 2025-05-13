import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { sortBy, without } from "min-dash";
import { CheckboxEntry } from "@bpmn-io/properties-panel";


export function PlaceProps(props) {
  const { element } = props;

  if (!is(element, `${MODELER_PREFIX}:Place`)) {
    return [];
  }

  const dataClasses = getDataClasses(props.elementRegistry);
  return sortByName(dataClasses).map((dataClass) => {
    return {
      id: element.id + '-' + dataClass.id,
      component: ColorProperty,
      dataClass,
    };
  });
}

function ColorProperty(props) {
  const { element, dataClass } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const getValue = (element) => {
    const color = element.businessObject.color;
    return color && color.includes(dataClass);
  };

  const setValue = (value) => {
    let color = element.businessObject.color || [];
    if (value) {
      color.push(dataClass);
    } else {
      color = without(color, dataClass);
    }
    commandStack.execute('element.updateProperties', {
      element,
      properties: {
        color
      }
    });
  };

  return CheckboxEntry({
    element,
    id: element.id + '-in-color',
    label: translate(dataClass.name),
    getValue,
    setValue,
  });

}

function getDataClasses(elementRegistry) {
  return elementRegistry
    .filter((element) => is(element, `${MODELER_PREFIX}:Model`))[0]
    .businessObject
    .declarations;
}

// function getDataClassById(elementRegistry, id) {
//   return getDataClasses(elementRegistry).find((declaration) => declaration.id === id);
// }

function sortByName(elements) {
  return sortBy(elements, e => (e.name || '').toLowerCase());
}
