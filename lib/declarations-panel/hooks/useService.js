import {
  useContext
} from '@bpmn-io/properties-panel/preact/hooks';

import { DeclarationsPanelContext } from '../context';

export function useService(type, strict) {
  const {
    getService
  } = useContext(DeclarationsPanelContext);

  return getService(type, strict);
}
