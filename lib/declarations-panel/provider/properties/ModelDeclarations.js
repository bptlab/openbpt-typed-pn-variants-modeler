import { without } from "min-dash";
import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { TextFieldEntry } from "@bpmn-io/properties-panel";
import { useService } from "../../hooks";
import { isLabel } from "../../../modeling/LabelUtil";


export function ModelDeclarationsProps(props) {
  const { element, injector } = props;

  if (!is(element, `${MODELER_PREFIX}:Model`)) {
    return null;
  }

  const commandStack = injector.get('commandStack');
  const customElementFactory = injector.get('customElementFactory');
  const elementRegistry = injector.get('elementRegistry');

  const existingDeclarations = element.businessObject.declarations || [];
  const listItems = existingDeclarations.map((declaration) => (
    {
      id: declaration.id + '-field',
      label: declaration.name,
      entries: [
        {
          id: declaration.id + '-name',
          component: NameProperty,
          declaration
        },
        {
          id: declaration.id + '-alias',
          component: AliasProperty,
          declaration
        },
        {
          id: declaration.id + '-valueType',
          component: ValueTypeProperty,
          declaration
        }
      ],
      remove: removeFactory({ element, declaration, commandStack, elementRegistry })
    }
  ));

  return {
    items: listItems,
    add: addFactory({ element, customElementFactory, commandStack })
  };
}

function NameProperty(props) {
  const { element, declaration } = props;
  
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: declaration,
      properties: {
        name: value
      }
    })
  }

  const getValue = (declaration) => {
    return declaration.name;
  }

  return TextFieldEntry({
    element: declaration,
    id: declaration.id + '-name',
    label: translate('Name'),
    getValue,
    setValue,
    debounce
  });
}

function AliasProperty(props) {
  const { element, declaration } = props;
  
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: declaration,
      properties: {
        alias: value
      }
    })
  }

  const getValue = (declaration) => {
    return declaration.alias;
  }

  return TextFieldEntry({
    element: declaration,
    id: declaration.id + '-alias',
    label: translate('Alias'),
    getValue,
    setValue,
    debounce
  });
}

function ValueTypeProperty(props) {
  const { element, declaration } = props;
  
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: declaration,
      properties: {
        valueType: value
      }
    })
  }

  const getValue = (declaration) => {
    return declaration.valueType;
  }

  return TextFieldEntry({
    element: declaration,
    id: declaration.id + '-value-type',
    label: translate('ValueType'),
    getValue,
    setValue,
    debounce
  });
}

function removeFactory({ element, declaration, commandStack, elementRegistry }) {
  return function(event) {
    event.stopPropagation();

    const referencingPlaces = elementRegistry.filter((element) => {
      return is(element, `${MODELER_PREFIX}:Place`) &&
             !isLabel(element) &&
             element.businessObject.color &&
             element.businessObject.color.includes(declaration);
    });

    if (referencingPlaces.length > 0) {
      const singular = referencingPlaces.length === 1;
      window.alert(
        `There ${singular ? 'is' : 'are'} ${referencingPlaces.length} place${singular ? '' : 's'} referencing this data class. Please remove all references before deleting the data class.`
      );
      return;
    }

    const declarations = element.businessObject.declarations;

    commandStack.execute('element.updateProperties', {
      element,
      properties: {
        declarations: without(declarations, declaration)
      }
    });
  };
}

function addFactory({ element, customElementFactory, commandStack }) {
  return function(event) {
    event.stopPropagation();

    const newDeclaration = createElement(`${MODELER_PREFIX}:DataClass`, { name: "NewClass", alias: "NewClass", valueType: "string" }, element, customElementFactory);

    commandStack.execute('element.updateProperties', {
      element,
      properties: {
        declarations: [...element.businessObject.declarations, newDeclaration]
      }
    });
  }
}

function createElement(type, attrs, parent, elementFactory) {
  const newElement = elementFactory.create(type, attrs);
  if (parent) {
    newElement.$parent = parent;
  }

  return newElement;
}
