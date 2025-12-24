interface DataClassInfo {
  isVariable: boolean;
  alias: string;
  tokenValues: TokenValue["value"][];
}

interface ArcPlaceInfo {
  arcId: string;
  placeId: string;
  tokens: Token[];
  isInhibitorArc: boolean;
  isLinkingPlace: boolean;
  variableClass: DataClass | undefined;
  dataClassInfoDict: {
    [dataClassId: string]: DataClassInfo;
  };
}

interface ArcPlaceInfoDict {
  [arcId: string]: ArcPlaceInfo;
}

// Token: An Array of TokenValue representing one token
type Token = { [DataClassKey: string]: string };

// Link: An array of id-label-pairs representing a link
type Link = { id: string; alias: string; isVariable: boolean }[];

// LinkTokenPerLink: A mapping from a data class combination key to an 
// array of LinkTokens
type TokenPerLink = { [dataClassCombinationKey: string]: Token[] };

// Binding: A mapping from dataClass id, alias and isVariable to an array
// of values representing all available tokenValues for that data class
// (given a specific link)
type BindingPerDataClass = { [DataClassKey: string]: string[] };

// TokenStructure: A set of data class keys representing all data classes
// used in the tokens of the respective arcs
type TokenStructure = Set<string> // LinkDataClass[];