import {
  getValidInputBindings,
  transitionIsEnabled,
  cartesianProduct,
  getValidInputBindingsBasic,
} from "./bindingUtils";

export {
  getValidInputBindings,
  transitionIsEnabled,
  cartesianProduct,
  getValidInputBindingsBasic,
};

export function getChildById(element, id) {
  return element.children.find((child) => child.id === id);
}
