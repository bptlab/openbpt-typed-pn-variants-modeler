/* eslint-disable @typescript-eslint/no-unused-vars */
interface ModelElement {
  id: string;
}

interface Node extends ModelElement {}

interface Transition extends Node {
  incoming: Array<Arc>;
  outgoing: Array<Arc>;
}

interface Place extends Node {
  incoming: Array<Arc>;
  outgoing: Array<Arc>;
  marking: Array<any>;
  color: Array<DataClass>;
}

interface TokenValue {
  dataClass: DataClass;
  value: string;
}

interface Arc extends ModelElement {
  businessObject: {
    source: Node;
    target: Node;
    isInhibitorArc?: boolean;
    variableType?: DataClass;
    inscription: any | null; // TODO: check if can be null
  };
}

interface DataClass extends ModelElement {
  label: string;
}

// interface Inscription {
//   inscriptionElements: Array<InscriptionElement>;
// }

// interface InscriptionElement {
//   dataClass: DataClass;
//   variableName: string;
//   isGenerated: boolean;
// }
