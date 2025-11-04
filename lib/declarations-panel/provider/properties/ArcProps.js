import { getArcColor, isWritingArc, sortByName } from "./Util";
import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { TextFieldEntry, CheckboxEntry } from "@bpmn-io/properties-panel";

const IS_GENERATED_DEFAULT = false;

export function ArcProps(props) {
  const { element } = props;

  if (!is(element, `${MODELER_PREFIX}:Arc`)) {
    return null;
  }

  const arcColor = getArcColor(element);

  if (!arcColor || !arcColor.length) {
    return {
      items: []
    };
  }

  const listItems = sortByName(arcColor).map((dataClass) => {
    const inscriptionElement = getInscriptionElement(element, dataClass);
    const entries = [
      {
        id: dataClass.id + 'variableName',
        component: VariableNameProperty,
        inscriptionElement,
        dataClass
      }
    ];

    // Reading arcs cannot generate new tokens. The list data class of variable arcs cannot be generated.
    if (isWritingArc(element) && !(element.businessObject.variableType === dataClass)) {
      entries.push({
        id: dataClass.id + 'isGenerated',
        component: IsGeneratedProperty,
        inscriptionElement,
        dataClass
      });
    }

    return {
      id: dataClass.id + 'inscription',
      label: dataClass.name,
      entries
    }
  });

  return {
    items: listItems
  };
}

function VariableNameProperty(props) {
  const { element, inscriptionElement, dataClass } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: inscriptionElement,
      properties: {
        variableName: value
      }
    });
  }

  const getValue = (element) => {
    const inscriptionElement = getInscriptionElement(element, dataClass);
    if (inscriptionElement && inscriptionElement.variableName) {
      return inscriptionElement.variableName;
    } else {
      return dataClass.alias;
    }
  }

  return TextFieldEntry({
    element,
    id: dataClass.id + 'variableNameInput',
    label: translate('Variable Name'),
    getValue,
    setValue,
    debounce
  });
}

function IsGeneratedProperty(props) {
  const { element, inscriptionElement, dataClass } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: inscriptionElement,
      properties: {
        isGenerated: value
      }
    });
  }

  const getValue = (element) => {
    const inscriptionElement = getInscriptionElement(element, dataClass);
    if (inscriptionElement && inscriptionElement.isGenerated) {
      return inscriptionElement.isGenerated;
    } else {
      return IS_GENERATED_DEFAULT;
    }
  }

  return CheckboxEntry({
    element,
    id: dataClass.id + 'isGeneratedInput',
    label: translate('Generate new Token'),
    getValue,
    setValue,
    debounce
  });
}

export function getInscriptionElement(arc, dataClass) {
  const arcInscription = arc.businessObject.inscription;
  if (arcInscription && arcInscription.inscriptionElements) {
    return arcInscription.inscriptionElements.find((element) => element.dataClass === dataClass);
  }
  return null;
}
