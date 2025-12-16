import {
  getValidInputBindings,
  getValidInputBindingsBasic,
} from "./bindingUtils";

// TODO: change all imports to bindingUtilsNew
import { transitionIsEnabled } from "./bindingUtilsNew";

export {
  getValidInputBindings,
  transitionIsEnabled,
  getValidInputBindingsBasic,
};

export function getChildById(element, id) {
  return element.children.find((child) => child.id === id);
}
