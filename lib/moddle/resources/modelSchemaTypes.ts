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

interface DataClassInfo {
  isVariable: boolean;
  label: string;
  tokenValues: TokenValue["value"][];
}

interface ArcPlaceInfo {
  arcId: string;
  placeId: string;
  tokens: Token[];
  isInhibitorArc: boolean;
  isLinkingPlace: boolean;
  variableClass: DataClass | undefined; // TODO: needed?
  dataClassInfoDict: {
    [dataClassId: string]: DataClassInfo;
  };
}

interface ArcPlaceInfoDict {
  [arcId: string]: ArcPlaceInfo;
}

// Token: An Array of TokenValue representing one token
type Token = TokenValue[];

// Binding: An Array of Token[] representing one possible binding
// Token[]: all possible token per arc, which are later choosable
type Binding = Token[][];

// Link: An array of id-label-pairs representing a link
// type Link = DataClass[];

type LinkToken = {variableType: DataClass | undefined; values: Token};

type LinkTokenPerPlace = { [placeId: string]: LinkToken[] };

// OutputToken: A mapping from dataClass label to value that is used by FireTransitionHandler
type OutputToken = { [label: string]: string };

// OutputBinding: An array of OutputToken arrays representing one output binding
type OutputBinding = OutputToken[][];


type Link = { id: string; label: string }[];