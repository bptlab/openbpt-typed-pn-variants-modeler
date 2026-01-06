import {
  getValidInputBindings,
  getValidInputBindingsBasic,
} from "./binding-utils/bindingUtils";

// TODO: change all imports to bindingUtilsNew
import { transitionIsEnabled } from "./binding-utils/bindingUtils";

export {
  getValidInputBindings,
  transitionIsEnabled,
  getValidInputBindingsBasic,
};

export function getChildById(element, id) {
  return element.children.find((child) => child.id === id);
}
