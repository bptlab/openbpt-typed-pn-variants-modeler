import DeclarationsPanelRenderer from "./DeclarationsPanelRenderer";

import Commands from "../cmd";
import {
  DebounceInputModule,
  FeelPopupModule,
} from "@bpmn-io/properties-panel";

export default {
  __depends__: [Commands, DebounceInputModule, FeelPopupModule],
  __init__: ["declarationsPanel"],
  declarationsPanel: ["type", DeclarationsPanelRenderer],
};
