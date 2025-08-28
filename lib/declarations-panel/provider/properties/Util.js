import { sortBy, without } from "min-dash";
import { is } from "../../../util/Util";
import { MODELER_PREFIX } from "../../../util/constants";

export function sortByName(elements) {
  return sortBy(elements, (e) => (e.name || "").toLowerCase());
}

export function getDataClasses(elementRegistry) {
  return elementRegistry.filter((element) =>
    is(element, `${MODELER_PREFIX}:Model`)
  )[0].businessObject.declarations;
}

export function getDataClassById(elementRegistry, id) {
  return getDataClasses(elementRegistry).find(
    (declaration) => declaration.id === id
  );
}

export function getArcColor(arc) {
  const source = arc.businessObject.source;
  const target = arc.businessObject.target;

  if (is(source, `${MODELER_PREFIX}:Place`)) {
    return source.color;
  } else {
    return target.color;
  }
}

export function isWritingArc(arc) {
  const source = arc.businessObject.source;
  return is(source, `${MODELER_PREFIX}:Transition`);
}

export function createDefaultInscriptionElementForClass(
  dataClass,
  parent,
  customElementFactory
) {
  const inscriptionElement = customElementFactory.create(
    `${MODELER_PREFIX}:InscriptionElement`,
    {
      dataClass,
      isGenerated: false,
      variableName: dataClass.alias,
    }
  );
  inscriptionElement.$parent = parent;
  return inscriptionElement;
}

export function createToken(
  place,
  values,
  customElementFactory,
  commandStack,
  extraContext
) {
  const initialTokenValues = place.businessObject.color.map((dataClass) => {
    return customElementFactory.create(`${MODELER_PREFIX}:TokenValue`, {
      dataClass,
      value: values[dataClass.id],
    });
  });

  const token = customElementFactory.create(`${MODELER_PREFIX}:Token`, {
    values: initialTokenValues,
  });

  initialTokenValues.forEach((value) => {
    value.$parent = token;
  });
  token.$parent = place;

  // Rerender place to show the new token
  // TODO: Check if sidebar re-renders correctly
  const ctx = Object.assign({}, extraContext || {}, {
    element: place,
    properties: {
      marking: [...(place.businessObject.marking || []), token],
    },
  });
  commandStack.execute("element.updateProperties", ctx);

  return token;
}

export function removeTokenFromPlace(place, token, commandStack) {
  const marking = place.businessObject.marking || [];
  if (!marking.includes(token)) {
    return;
  }
  const newMarking = without(marking, token);
  commandStack.execute("element.updateProperties", {
    element: place,
    properties: {
      marking: newMarking,
    },
  });
}

export function getTokenValues(token) {
  const values = {};
  token.values.forEach((value) => {
    values[value.dataClass.id] = value.value;
  });
  return values;
}

export function getTokenValuesString(token) {
  const values = getTokenValues(token);
  const valuesString = Object.values(values).join(", ");
  return `(${valuesString})`;
}
