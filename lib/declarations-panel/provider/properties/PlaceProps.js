import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { sortBy } from "min-dash";
import ReferenceSelect from "./ReferenceSelect";


export function PlaceProps(props) {
  const { element } = props;

  if (!is(element, `${MODELER_PREFIX}:Place`)) {
    return [];
  }

  return [
    {
      id: 'color',
      component: ColorProperty,
    }
  ];
}

function ColorProperty(props) {
  const { element } = props;

  const commandStack = useService('commandStack');
  const elementRegistry = useService('elementRegistry');
  const translate = useService('translate');

  const getValue = (element) => {
    const color = element.businessObject.color;
    return color && color.id;
  };

  const setValue = (value) => {
    const dataClass = getDataClassById(elementRegistry, value);
    commandStack.execute('element.updateProperties', {
      element,
      properties: {
        color: dataClass
      }
    });
  };

  const getOptions = () => {
    const options = [];

    const dataClasses = getDataClasses(elementRegistry);

    sortByName(dataClasses).forEach((dataClass) => {
      options.push({
        value: dataClass.id,
        label: dataClass.name
      });
    });

    return options;
  };

  return ReferenceSelect({
    element,
    id: 'color',
    label: translate('Color'),
    getValue,
    setValue,
    getOptions,
  });
}

function getDataClasses(elementRegistry) {
  return elementRegistry
    .filter((element) => is(element, `${MODELER_PREFIX}:Model`))[0]
    .businessObject
    .declarations;
}

function getDataClassById(elementRegistry, id) {
  return getDataClasses(elementRegistry).find((declaration) => declaration.id === id);
}

function sortByName(elements) {
  return sortBy(elements, e => (e.name || '').toLowerCase());
}
