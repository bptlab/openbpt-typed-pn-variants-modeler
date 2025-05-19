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

    if (isWritingArc(element)) {
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
    let updatedInscriptionElement;
    if (!inscriptionElement) {
      updatedInscriptionElement = {
        dataClass: dataClass,
        variableName: value,
        isGenerated: IS_GENERATED_DEFAULT
      };
    } else {
      updatedInscriptionElement = {
        dataClass: inscriptionElement.dataClass,
        variableName: value,
        isGenerated: inscriptionElement.isGenerated
      };
    }

    const currentInscriptionElements = element.businessObject.inscription.inscriptionElements || [];
    let updatedInscriptionElements;
    if (getInscriptionElement(element, dataClass)) {
      updatedInscriptionElements = currentInscriptionElements.map((element) => (
        element.dataClass === dataClass
          ? updatedInscriptionElement
          : element
      ));
    } else {
      updatedInscriptionElements = [...currentInscriptionElements, updatedInscriptionElement];
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: element.businessObject.inscription,
      properties: {
        inscriptionElements: updatedInscriptionElements
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
    let updatedInscriptionElement;
    if (!inscriptionElement) {
      updatedInscriptionElement = {
        dataClass: dataClass,
        variableName: dataClass.alias,
        isGenerated: value
      };
    } else {
      updatedInscriptionElement = {
        dataClass: inscriptionElement.dataClass,
        variableName: inscriptionElement.variableName,
        isGenerated: value
      };
    }

    const currentInscriptionElements = element.businessObject.inscription.inscriptionElements || [];
    let updatedInscriptionElements;
    if (getInscriptionElement(element, dataClass)) {
      updatedInscriptionElements = currentInscriptionElements.map((element) => (
        element.dataClass === dataClass
          ? updatedInscriptionElement
          : element
      ));
    } else {
      updatedInscriptionElements = [...currentInscriptionElements, updatedInscriptionElement];
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: element.businessObject.inscription,
      properties: {
        inscriptionElements: updatedInscriptionElements
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

function getInscriptionElement(arc, dataClass) {
  const arcInscription = arc.businessObject.inscription;
  if (arcInscription && arcInscription.inscriptionElements) {
    return arcInscription.inscriptionElements.find((element) => element.dataClass === dataClass);
  }
  return null;
}
