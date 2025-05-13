import { sortBy } from "min-dash";
import { is } from "../../../util/Util";
import { MODELER_PREFIX } from "../../../util/constants";


export function sortByName(elements) {
  return sortBy(elements, e => (e.name || '').toLowerCase());
}

export function getDataClasses(elementRegistry) {
  return elementRegistry
    .filter((element) => is(element, `${MODELER_PREFIX}:Model`))[0]
    .businessObject
    .declarations;
}

export function getDataClassById(elementRegistry, id) {
  return getDataClasses(elementRegistry).find((declaration) => declaration.id === id);
}

export function getArcColor(element) {
  const source = element.businessObject.source;
  const target = element.businessObject.target;

  if (is(source, `${MODELER_PREFIX}:Place`)) {
    return source.color;
  } else {
    return target.color;
  }
}
