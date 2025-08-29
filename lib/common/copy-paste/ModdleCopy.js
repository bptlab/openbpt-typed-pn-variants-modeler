import {
  find,
  forEach,
  has,
  isArray,
  isDefined,
  isObject,
  matchPattern,
  reduce,
  sortBy
} from 'min-dash';
import { MODELER_PREFIX } from '../../util/constants';
import { Events } from '../EventBusEvents';


const DISALLOWED_PROPERTIES = [];

const REFERENCES_TO_COPY = {
  [`${MODELER_PREFIX}:InscriptionElement`]: 'dataClass',
  [`${MODELER_PREFIX}:Arc`]: 'variableType',
  [`${MODELER_PREFIX}:Place`]: 'color',
  [`${MODELER_PREFIX}:TokenValue`]: 'dataClass'
}

export default class ModdleCopy {
  constructor(eventBus, customElementFactory, moddle) {
    this._customElementFactory = customElementFactory;
    this._eventBus = eventBus;
    this._moddle = moddle;

    // copy extension elements last
    eventBus.on(Events.MODDLECOPY_CAN_COPY_PROPERTIES, function (context) {
      const propertyNames = context.propertyNames;

      if (!propertyNames || !propertyNames.length) {
        return;
      }

      return sortBy(propertyNames, function (propertyName) {
        return propertyName === 'extensionElements';
      });
    });

    // default check whether property can be copied
    eventBus.on(Events.MODDLECOPY_CAN_COPY_PROPERTY, function (context) {
      const parent = context.parent;
      const parentDescriptor = isObject(parent) && parent.$descriptor;
      const propertyName = context.propertyName;

      if (propertyName && DISALLOWED_PROPERTIES.indexOf(propertyName) !== -1) {

        // disallow copying property
        return false;
      }

      if (propertyName &&
        parentDescriptor &&
        !find(parentDescriptor.properties, matchPattern({ name: propertyName }))) {

        // disallow copying property
        return false;
      }
    });
  }

  /**
   * Copy model properties of source element to target element.
   *
   * @param {ModdleElement} sourceElement
   * @param {ModdleElement} targetElement
   * @param {string[]} [propertyNames]
   *
   * @return {ModdleElement}
   */
  copyElement(sourceElement, targetElement, propertyNames) {
    const self = this;

    if (propertyNames && !isArray(propertyNames)) {
      propertyNames = [propertyNames];
    }

    propertyNames = propertyNames || getPropertyNames(sourceElement.$descriptor);

    const canCopyProperties = this._eventBus.fire(Events.MODDLECOPY_CAN_COPY_PROPERTIES, {
      propertyNames: propertyNames,
      sourceElement: sourceElement,
      targetElement: targetElement,
    });

    if (canCopyProperties === false) {
      return targetElement;
    }

    if (isArray(canCopyProperties)) {
      propertyNames = canCopyProperties;
    }

    // copy properties
    forEach(propertyNames, function (propertyName) {
      let sourceProperty;

      if (has(sourceElement, propertyName)) {
        sourceProperty = sourceElement.get(propertyName);
      }

      const copiedProperty = self.copyProperty(sourceProperty, targetElement, propertyName);

      if (!isDefined(copiedProperty)) {
        return;
      }

    const canSetProperty = self._eventBus.fire(Events.MODDLECOPY_CAN_SET_COPIED_PROPERTY, {
        parent: targetElement,
        property: copiedProperty,
        propertyName: propertyName
      });

      if (canSetProperty === false) {
        return;
      }

      targetElement.set(propertyName, copiedProperty);
    });

    return targetElement;
  }
  /**
   * Copy model property.
   *
   * @param {any} property
   * @param {ModdleElement} parent
   * @param {string} propertyName
   *
   * @return {any}
   */
  copyProperty(property, parent, propertyName) {
    const self = this;

    // allow others to copy property
    let copiedProperty = this._eventBus.fire(Events.MODDLECOPY_CAN_COPY_PROPERTY, {
      parent: parent,
      property: property,
      propertyName: propertyName,
    });

    // return if copying is NOT allowed
    if (copiedProperty === false) {
      return;
    }

    if (copiedProperty) {
      if (isObject(copiedProperty) && copiedProperty.$type && !copiedProperty.$parent) {
        copiedProperty.$parent = parent;
      }

      return copiedProperty;
    }

    const propertyDescriptor = this._moddle.getPropertyDescriptor(parent, propertyName);

    // do NOT copy ids and references
    if (propertyDescriptor.isId || propertyDescriptor.isReference) {
      if (Object.keys(REFERENCES_TO_COPY).includes(parent.$type) && propertyName === REFERENCES_TO_COPY[parent.$type]) {
        return property;
      }
      else {
        return;
      }
    }

    // copy arrays
    if (isArray(property)) {
      return reduce(property, function (childProperties, childProperty) {

        // recursion
        copiedProperty = self.copyProperty(childProperty, parent, propertyName);

        // copying might NOT be allowed
        if (copiedProperty) {
          return childProperties.concat(copiedProperty);
        }

        return childProperties;
      }, []);
    }

    // copy model elements
    if (isObject(property) && property.$type) {
      if (this._moddle.getElementDescriptor(property).isGeneric) {
        return;
      }

      copiedProperty = self._customElementFactory.create(property.$type);

      copiedProperty.$parent = parent;

      // recursion
      copiedProperty = self.copyElement(property, copiedProperty);

      return copiedProperty;
    }

    // copy primitive properties
    return property;
  }
}

ModdleCopy.$inject = [
  'eventBus',
  'customElementFactory',
  'moddle'
];

// helpers //////////

export function getPropertyNames(descriptor, keepDefaultProperties) {
  return reduce(descriptor.properties, function(properties, property) {

    if (keepDefaultProperties && property.default) {
      return properties;
    }

    return properties.concat(property.name);
  }, []);
}
