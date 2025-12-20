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
type Token = TokenValue[];

// Binding: An Array of Token[] representing one possible binding
// Token[]: all possible token per arc, which are later choosable
type Binding = Token[][];

// Link: An array of id-label-pairs representing a link
type Link = { id: string; alias: string; isVariable: boolean }[];

type LinkToken = {variableType: DataClass | undefined; token: Token};

// LinkTokenPerPlace: A mapping from placeId to an array of LinkTokens
type LinkTokenPerPlace = { [placeId: string]: LinkToken[] };

// PlaceIdPerDataClass: A mapping from dataClass id, 
// alias and isVariable to an array of placeId's
type PlaceIdPerDataClass = { [key: string]: string[] };

// OutputToken: A mapping from dataClass label to value that is used by 
// FireTransitionHandler
type OutputToken = { [label: string]: string };

// OutputBinding: An array of OutputToken arrays representing one output 
// binding
type OutputBinding = OutputToken[][];

// TokenStructure: An array of Links, where one Link represents one
// data class structure of an input token (we explicitly want to allow 
// duplicates, if they are ordered differently)
type TokenStructure = Set<Link>;