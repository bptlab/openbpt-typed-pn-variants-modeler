import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { getInscriptionElement } from "./ArcProps";
import ReferenceSelect from "./ReferenceSelect";
import { sortByName, getDataClassById, getArcColor } from "./Util";
import { CheckboxEntry } from "@bpmn-io/properties-panel";

export function VariableArcProps(props) {
  const { element } = props;

  if (!is(element, `${MODELER_PREFIX}:Arc`)) {
    return [];
  }

  const entries = [
    {
      id: "variableType",
      component: VariableTypeProperty,
    },
  ];

  if (element.businessObject.variableType) {
    entries.push({
      id: "isExactSynchronization",
      component: IsExactSynchronizationProperty,
    });
  }

  return entries;
}

function VariableTypeProperty(props) {
  const { element } = props;

  const commandStack = useService("commandStack");
  const translate = useService("translate");
  const elementRegistry = useService("elementRegistry");
  const readOnly = useService("simulationModeService").isActive();

  const getValue = (element) => {
    const variableType = element.businessObject.variableType;
    return variableType ? variableType.id : "";
  };

  const setValue = (value) => {
    const dataClass = getDataClassById(elementRegistry, value);
    const inscriptionElement = getInscriptionElement(element, dataClass);
    if (inscriptionElement && inscriptionElement.isGenerated) {
      commandStack.execute("element.updateModdleProperties", {
        element,
        moddleElement: inscriptionElement,
        properties: {
          isGenerated: false,
        },
      });
    }
    commandStack.execute("element.updateProperties", {
      element,
      properties: {
        variableType: dataClass,
        isExactSynchronization: false,
      },
    });
  };

  const getOptions = () => {
    const options = [{ value: "", label: translate("<none>") }];

    const arcColor = getArcColor(element);

    if (arcColor && arcColor.length) {
      sortByName(arcColor).forEach((dataClass) => {
        options.push({
          value: dataClass.id,
          label: dataClass.name,
        });
      });
    }

    return options;
  };

  return ReferenceSelect({
    element,
    id: "variableType",
    label: translate("Variable Type"),
    getValue,
    setValue,
    getOptions,
    disabled: readOnly,
  });
}

function IsExactSynchronizationProperty(props) {
  const { element } = props;

  const commandStack = useService("commandStack");
  const translate = useService("translate");
  const debounce = useService("debounceInput");
  const readOnly = useService("simulationModeService").isActive();

  const setValue = (value) => {
    commandStack.execute("element.updateProperties", {
      element,
      properties: {
        isExactSynchronization: value,
      },
    });
  };

  const getValue = (element) => {
    return element.businessObject.isExactSynchronization;
  };

  return CheckboxEntry({
    element,
    id: "isExactSynchronization",
    label: translate("Is Exact Synchronization?"),
    getValue,
    setValue,
    debounce,
    disabled: readOnly,
  });
}
