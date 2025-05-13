import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { sortBy } from "min-dash";
import ReferenceSelect from "./ReferenceSelect";


export function VariableArcProps(props) {
  const { element } = props;

  if (!is(element, `${MODELER_PREFIX}:Arc`)) {
    return [];
  }

  return [
    {
      id: 'variableType',
      component: VariableTypeProperty,
    }
  ];
}

function VariableTypeProperty(props) {
  const { element } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const getValue = (element) => {
    return element.businessObject.variableType;
  };

  const setValue = (value) => {
    commandStack.execute('element.updateProperties', {
      element,
      properties: {
        variableType: value
      }
    });
  };

  const getOptions = () => {
    const options = [
      { value: '', label: translate('<none>')},
    ];

    const arcColor = getArcColor(element);

    if (arcColor && arcColor.length) {
      sortByName(arcColor).forEach((dataClass) => {
        options.push({
          value: dataClass.id,
          label: dataClass.name
        });
      });
    }

    return options;
  };

  return ReferenceSelect({
    element,
    id: 'variableType',
    label: translate('Variable Type'),
    getValue,
    setValue,
    getOptions,
  });
}

function getArcColor(element) {
  const source = element.businessObject.source;
  const target = element.businessObject.target;

  if (is(source, `${MODELER_PREFIX}:Place`)) {
    return source.color;
  } else {
    return target.color;
  }
}

function sortByName(elements) {
  return sortBy(elements, e => (e.name || '').toLowerCase());
}
