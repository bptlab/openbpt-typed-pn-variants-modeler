import {
  getValidInputBindings,
  transitionIsEnabled,
  getValidInputBindingsBasic,
} from "./bindingUtils";

export {
  getValidInputBindings,
  transitionIsEnabled,
  getValidInputBindingsBasic,
};

export function getChildById(element, id) {
  return element.children.find((child) => child.id === id);
}
