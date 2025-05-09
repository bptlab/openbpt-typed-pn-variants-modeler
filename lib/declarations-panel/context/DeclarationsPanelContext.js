import {
  createContext
} from '@bpmn-io/properties-panel/preact';

const DeclarationsPanelContext = createContext({
  selectedElement: null,
  injector: null,
  getService() { return null; }
});

export default DeclarationsPanelContext;
