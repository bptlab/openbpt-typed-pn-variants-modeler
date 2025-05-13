import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { without } from "min-dash";
import { CheckboxEntry } from "@bpmn-io/properties-panel";
import { sortByName, getDataClasses } from "./Util";


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
    let commands = [];
    let color = element.businessObject.color || [];

    if (value) {
      color.push(dataClass);
    } else {
      color = without(color, dataClass);
    }

    commands.push({
      cmd: 'element.updateProperties',
      context: {
        element,
        properties: {
          color
        }
      }
    });

    // Remove variableType of connected arcs if color is removed
    if (!value) {
      const connectedArcs = [...element.outgoing, ...element.incoming];
      if (connectedArcs.length) {
        connectedArcs.forEach((arc) => {
          if (arc.businessObject.variableType === dataClass) {
            commands.push({
              cmd: 'element.updateProperties',
              context: {
                element: arc,
                properties: {
                  variableType: undefined
                }
              }
            });
          }
        });
      }
    }

    commandStack.execute('properties-panel.multi-command-executor', commands);
  };

  return CheckboxEntry({
    element,
    id: element.id + '-in-color',
    label: translate(dataClass.name),
    getValue,
    setValue,
  });
}
