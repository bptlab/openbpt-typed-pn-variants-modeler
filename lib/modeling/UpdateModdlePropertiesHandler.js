import { reduce, keys, forEach } from 'min-dash';


export default class UpdateModdlePropertiesHandler {
  constructor(elementRegistry) {
    this._elementRegistry = elementRegistry;
  }

  execute(context) {
    const moddleElement = context.moddleElement;
    const properties = context.properties;

    if (!moddleElement) {
      throw new Error('<moddleElement> required');
    }

    // TODO(nikku): we need to ensure that ID properties
    // are properly registered / unregistered via
    // this._moddle.ids.assigned(id)
    const changed = context.changed;
    const oldProperties = context.oldProperties || getModdleProperties(moddleElement, keys(properties));

    setModdleProperties(moddleElement, properties);

    context.oldProperties = oldProperties;
    context.changed = changed;

    return changed;
  }

  revert(context) {
    const oldProperties = context.oldProperties;
    const moddleElement = context.moddleElement;
    const changed = context.changed;

    setModdleProperties(moddleElement, oldProperties);

    return changed;
  }
}

UpdateModdlePropertiesHandler.$inject = [ 'elementRegistry' ];

// helpers /////////////////

function getModdleProperties(moddleElement, propertyNames) {
  return reduce(propertyNames, function(result, key) {
    result[key] = moddleElement.get(key);
    return result;
  }, {});
}

function setModdleProperties(moddleElement, properties) {
  forEach(properties, function(value, key) {
    moddleElement.set(key, value);
  });
}
