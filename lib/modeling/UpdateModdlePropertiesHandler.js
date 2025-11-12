import { reduce, keys, forEach } from "min-dash";
import { is, getBusinessObject } from "../util/Util";
import { MODELER_PREFIX } from "../util/constants";
import {
  existsExternalLabel,
  getArcInscriptionText,
  getExternalLabelMid,
  getLabel,
} from "./LabelUtil";

var NULL_DIMENSIONS = {
  width: 0,
  height: 0,
};

export default class UpdateModdlePropertiesHandler {
  constructor(elementRegistry, textRenderer, modeling) {
    this._elementRegistry = elementRegistry;
    this._textRenderer = textRenderer;
    this._modeling = modeling;
  }

  execute(context) {
    const moddleElement = context.moddleElement;
    const properties = context.properties;

    if (!moddleElement) {
      throw new Error("<moddleElement> required");
    }

    // TODO(nikku): we need to ensure that ID properties
    // are properly registered / unregistered via
    // this._moddle.ids.assigned(id)
    const changed = context.changed;
    const oldProperties =
      context.oldProperties ||
      getModdleProperties(moddleElement, keys(properties));

    setModdleProperties(moddleElement, properties);

    context.oldProperties = oldProperties;
    context.changed = changed;

    return changed;
  }

  postExecute(context) {
    const element = context.element;
    if (is(element, `${MODELER_PREFIX}:Arc`) && existsExternalLabel(element)) {
      const label = element.label;
      const text = getArcInscriptionText(getBusinessObject(element));

      // get layouted text bounds and resize external label accordingly
      const newLabelBounds = this._textRenderer.getExternalLabelBounds(
        label,
        text,
      );
      this._modeling.resizeShape(label, newLabelBounds, NULL_DIMENSIONS);
    } else if (
      is(element, `${MODELER_PREFIX}:Arc`) &&
      !existsExternalLabel(element)
    ) {
      const businessObject = element.businessObject;
      // small vertical offset so label doesn't overlap the connection
      const paddingTop = 7;

      // compute label center (flow or element-centered)
      let labelCenter = getExternalLabelMid(element);
      labelCenter = { x: labelCenter.x, y: labelCenter.y + paddingTop };

      // compute required label dimensions from text
      const labelText = getLabel(element) || "";
      const labelDimensions = this._textRenderer.getExternalLabelBounds(
        // This input does not matter, the TextRenderer will fit the bounds to the text
        { width: 10, height: 10 },
        labelText,
      );

      // create the external label shape
      this._modeling.createLabel(element, labelCenter, {
        id: businessObject.id + "_label",
        businessObject: businessObject,
        width: labelDimensions.width,
        height: labelDimensions.height,
      });
    }
  }

  revert(context) {
    const oldProperties = context.oldProperties;
    const moddleElement = context.moddleElement;
    const changed = context.changed;

    setModdleProperties(moddleElement, oldProperties);

    return changed;
  }
}

UpdateModdlePropertiesHandler.$inject = [
  "elementRegistry",
  "textRenderer",
  "modeling",
];

// helpers /////////////////

function getModdleProperties(moddleElement, propertyNames) {
  return reduce(
    propertyNames,
    function (result, key) {
      result[key] = moddleElement.get(key);
      return result;
    },
    {},
  );
}

function setModdleProperties(moddleElement, properties) {
  forEach(properties, function (value, key) {
    moddleElement.set(key, value);
  });
}
