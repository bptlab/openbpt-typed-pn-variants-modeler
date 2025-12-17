/* eslint-disable @typescript-eslint/no-unused-vars */
interface ModelElement {
  id: string;
  // name: string;
}

interface Node extends ModelElement {}

interface Transition extends Node {
  incoming: Array<Arc>;
  outgoing: Array<Arc>;
}

interface Place extends Node {
  incoming: Array<Arc>;
  outgoing: Array<Arc>;
  marking: Array<Token>;
  color: Array<DataClass>;
}

interface Token {
  values: Array<TokenValue>;
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
    inscription: Inscription | null; // TODO: check if can be null
  };
}

// ----------------

interface Decleration {
  id: string;
  // name: string;
}

interface DataClass extends Decleration {
  label: string;
}

interface Inscription {
  inscriptionElements: Array<InscriptionElement>;
}

interface InscriptionElement {
  dataClass: DataClass;
  variableName: string;
  isGenerated: boolean;
}
