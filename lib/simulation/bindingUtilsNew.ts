import { get } from "http";

// Token: Maps label (e.g. O) to concrete value from token (e.g. Order_1)
type Token = { [label: string]: string };

// Binding: An Array of Array<Token> representing one possible binding
// Array<Token>: all possible token per arc, which are later choosable
type Binding = Array<Array<Token>>;
// type Binding = { [label: string]: Array<string> };

// Link: An array of id-label-pairs representing a link
type Link = Array<DataClass>;

// AllLinks: All incoming links
type AllLinks = Array<Link>;

// ArcBindingCandidates: All possible bindings for one arc
type ArcBindingCandidates = Array<Binding>;

// ValidBindings: All valid complete bindings for a transition
// (chooses one binding from each ArcBindingsCandidates per arc)
type ValidBindings = Array<Binding>;

interface DataClassInfo {
  isVariable: boolean;
  label: string;
  tokenValues: Array<TokenValue["value"]>;
}

interface ArcPlaceInfo {
  arcId: string;
  placeId: string;
  token: Array<TokenValue>;
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

function buildArcPlaceInfo(arc: Arc): ArcPlaceInfo {
  const place: Place = arc.businessObject.source as Place;
  const isInhibitorArc: boolean = arc.businessObject.isInhibitorArc || false;

  const dataClassInfoDict: {
    [dataClassId: string]: DataClassInfo;
  } = {};

  const marking = place.marking ?? [];

  for (const token of marking) {
    const tokenValues = token.values ?? [];
    for (const { dataClass, value } of tokenValues) {
      if (!dataClass) continue;

      if (!dataClassInfoDict[dataClass.id]) {
        dataClassInfoDict[dataClass.id] = {
          isVariable: false,
          label: "",
          tokenValues: [],
        };
      }

      if (!dataClassInfoDict[dataClass.id].tokenValues.includes(value)) {
        dataClassInfoDict[dataClass.id].tokenValues.push(value);
      }
    }
  }

  let variableClass: DataClass | undefined = undefined;
  const inscriptionElements =
    arc.businessObject.inscription?.inscriptionElements ?? [];
  for (const element of inscriptionElements) {
    const dataClass = element.dataClass;
    const dataClassInfo = dataClassInfoDict[dataClass.id];
    if (dataClass?.id && dataClassInfo) {
      if (arc.businessObject.variableType === dataClass) {
        dataClassInfo.isVariable = true;
        variableClass = {id: dataClass.id, label: dataClass.label};
      }
      dataClassInfo.label = element.variableName;
    }
  }


  // TODO: This currently splits token into multiple TokenValues if it has multiple dataClasses
  // But we need to keep them together as one Token
  const customMarking: Array<TokenValue> = marking.flatMap((token) =>
    (token.values ?? [])
      .filter(({ dataClass }) => dataClass)
      .map(({ dataClass, value }) => ({ dataClass, value })),
  ); // Transforms marking of token into Array of TokenValues

  return {
    arcId: arc.id,
    placeId: place.id,
    token: customMarking,
    isInhibitorArc,
    isLinkingPlace: Object.keys(dataClassInfoDict).length > 1,
    variableClass,
    dataClassInfoDict,
  };
}

// Returns true if any output arc has a non-generated variable that was not defined in the input arcs
function hasUnboundOutputVariables(
  incomingArcs: Array<Arc>,
  outgoingArcs: Array<Arc>,
): boolean {
  const inputVariableNames = new Set<string>(
    incomingArcs
      .filter((arc) => !arc.businessObject.isInhibitorArc) // exclude inhibitor arcs
      .flatMap(
        (arc: Arc) => arc.businessObject.inscription?.inscriptionElements || [],
      )
      .map((el: any) => el.variableName),
  );

  return outgoingArcs
    .filter((arc) => !arc.businessObject.isInhibitorArc)
    .some((arc) => {
      const inscriptionElements =
        arc.businessObject.inscription?.inscriptionElements || [];
      return inscriptionElements.some(
        (el: InscriptionElement) =>
          !el.isGenerated && !inputVariableNames.has(el.variableName),
      );
    });
}

function hasMismatchedVariableTypes(
  incomingArcs: Array<Arc>,
  outgoingArcs: Array<Arc>,
): boolean {
  if (incomingArcs.length > 0 && outgoingArcs.length > 0) {
      const incomingDataclassNameDict = buildDataclassNameDictionary(incomingArcs);
      const outgoingDataclassNameDict = buildDataclassNameDictionary(outgoingArcs);
      // check that variable incoming and outgoing arcs match
      if (isMismatch(incomingDataclassNameDict, outgoingDataclassNameDict)) {
        return true;
      }  
    }
    
  return false;
}

function buildDataclassNameDictionary(arcs: Array<Arc>) {
  return arcs.reduce((dict: { [dataClassId: string]: Set<string> }, arc) => {
    const dataClassId = arc.businessObject?.variableType?.id;
    const inscriptionElements = arc.businessObject?.inscription?.inscriptionElements;
    // early return if missing info
    if (!dataClassId || !inscriptionElements) return dict;
    // add variable name to set for this dataClassId
    const varName: string = inscriptionElements.find(elem => elem.dataClass.id === dataClassId)?.variableName ?? "";
    if (!dict[dataClassId]) dict[dataClassId] = new Set<string>();
    dict[dataClassId].add(varName);

    return dict;
  }, {} as { [dataClassId: string]: Set<string> });
}

function isMismatch(dict1: { [key: string]: Set<string> }, dict2: { [key: string]: Set<string> }) {
  const keys1 = Object.keys(dict1);
  const keys2 = Object.keys(dict2);

  if (keys1.length !== keys2.length) return true;
  if (!keys1.every(key => keys2.includes(key))) return true;

  for (const key of keys1) {
    const val1 = [...dict1[key]];
    const val2 = [...dict2[key]];
    if (val1.length !== val2.length) return true;
    if (!val1.every(element => val2.includes(element))) return true;
  }
  return false;
}

// Check if all non-inhibitor arcs have at least one available token
function hasAvailableTokensForAllArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): boolean {
  return Object.values(arcPlaceInfoDict).every(
    (arcPlaceInfo) =>
      arcPlaceInfo.isInhibitorArc || arcPlaceInfo.token.length > 0,
  );
}

function getInhibitorTokens(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Array<TokenValue> {
  const inhibitorTokens: Array<TokenValue> = [];

  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isInhibitorArc) continue;

    inhibitorTokens.push(...arcPlaceInfo.token);
  }

  return inhibitorTokens;
}

function getBiggestLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Array<Link> {
  const allLinks: Array<Link> = getAllLinks(arcPlaceInfoDict);
  const uniqueLinks: Array<Link> = [];
  // Helper to compare two links for set equality (order-insensitive)
  function linksAreEqual(linkA: Link, linkB: Link): boolean {
    if (linkA.length !== linkB.length) return false;
    const aSet = new Set(linkA.map(l => `${l.id}:${l.label}`));
    const bSet = new Set(linkB.map(l => `${l.id}:${l.label}`));
    if (aSet.size !== bSet.size) return false;
    for (const item of aSet) {
      if (!bSet.has(item)) return false;
    }
    return true;
  }
  // Remove duplicates (order-insensitive)
  for (const link of allLinks) {
    if (!uniqueLinks.some(existing => linksAreEqual(existing, link))) {
      uniqueLinks.push(link);
    }
  }
  // Helper to check if linkA is a subset of linkB
  function linkIsSubset(linkA: Link, linkB: Link): boolean {
    const bSet = new Set(linkB.map(l => `${l.id}:${l.label}`));
    return linkA.every(l => bSet.has(`${l.id}:${l.label}`));
  }
  // Filter out links that are a subset of another link
  const biggestLinks = uniqueLinks.filter((link, idx, arr) =>
    !arr.some((other, otherIdx) =>
      otherIdx !== idx && linkIsSubset(link, other) && other.length > link.length
    )
  );

  return biggestLinks;
}

function getAllLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Array<Link> {
  const allLinks: Array<Link> = [];

  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isLinkingPlace) continue;

    const link: Link = [];
    for (const [dataClassId, dataClassInfo] of Object.entries(
      arcPlaceInfo.dataClassInfoDict,
    )) {
      if (dataClassInfo.label) {
        link.push({ id: dataClassId, label: dataClassInfo.label });
      }
    }

    allLinks.push(link);
  }

  return allLinks;
}

function cartesianProduct(arrays: Binding): Array<Binding> {
  // We want the cartesian product to return an array of arrays of Token,
  // where each inner array contains one Token from one input array.
  // The second inner array contains the product combinations.
  // As we want all product combinations, we need an Array of Binding as output.
  // For example, input: [[{I: "Item_1"}], [{O: "Order_3"}, {O: "Order_4"}]]
  // Output: [ [ [{I: "Item_1"}], [{O: "Order_3"}] ], [ [{I: "Item_1"}], [{O: "Order_4"}] ] ]
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return [arrays[0].map(item => [item])];

  const result: Array<Binding> = [];

  function helper(current: Array<Array<Token>>, depth: number) {
    if (depth === arrays.length) {
      result.push(current.map(arr => arr));
      return;
    }
    for (const item of arrays[depth]) {
      helper([...current, [item]], depth + 1);
    }
  }

  helper([], 0);
  return result;
}

function getLinkedBindingCandidates(
  jointSingleBindingCandidates: Array<Binding>,
  links: AllLinks,
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Array<Binding> {
  const linkedBindingCandidates: Array<Binding> = [];
  
  if (jointSingleBindingCandidates.length > 0) {
    // gather all link tokens from arcPlaceInfoDict
    const linkTokensDict: { [linkId: string]: Array<TokenValue> } = {};
    const linkLabelDataClassToLinkId: { [key: string]: Array<string> } = {};
    for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
      if (arcPlaceInfo.isLinkingPlace) {
        const linkId = arcPlaceInfo.arcId;
        linkTokensDict[linkId] = arcPlaceInfo.token;
        // Build a mapping from label and dataClassId to linkId
        for (const [dataClassId, dataClassInfo] of Object.entries(arcPlaceInfo.dataClassInfoDict)) {
          const key = `${dataClassInfo.label}::${dataClassId}`;
          if (!linkLabelDataClassToLinkId[key]) {
            linkLabelDataClassToLinkId[key] = [];
          }
          linkLabelDataClassToLinkId[key].push(linkId);
        }
      }
    }

    // For each joint binding candidate, check if any link token matches. 
    // If so, keep the binding candidate and extend it with the link token.
    for (const bindingCandidate of jointSingleBindingCandidates) {
      
    }
  }
  else {
    // Special case: only one linking arc: Return its tokens as bindings
    if (Object.keys(arcPlaceInfoDict).length === 1 && !arcPlaceInfoDict[Object.keys(arcPlaceInfoDict)[0]].isInhibitorArc) {
      
    }
  }

  return linkedBindingCandidates;
}

function tokensEqual(tokenA: TokenValue, tokenB: TokenValue): boolean {
  return (
    tokenA.dataClass.id === tokenB.dataClass.id && tokenA.value === tokenB.value
  );
}

function isTokenBlockedByInhibitor(
  token: TokenValue,
  inhibitorTokens: Array<TokenValue>,
): boolean {
  return inhibitorTokens.some((inhibitorToken) =>
    tokensEqual(token, inhibitorToken),
  );
}

function buildTokenFromTokenValue(
  token: TokenValue,
  dataClassInfoDict: { [dataClassId: string]: DataClassInfo },
): Token {
  const Token: Token = {};
  for (const [dataClassId, dataClassInfo] of Object.entries(
    dataClassInfoDict,
  )) {
    if (dataClassInfo.label && token.dataClass.id === dataClassId) {
      Token[dataClassInfo.label] = token.value;
    }
  }
  return Token;
}

export function getValidInputBindings(transition: Transition): Array<Binding> {
  console.log("Transition:", transition.id);
  // If no incoming arcs, transition is always enabled
  if (transition.incoming.length === 0) {
    console.log("Early return: no incoming arcs");
    return [[]]; // For consistency, return array with one empty binding
  }

  if (hasUnboundOutputVariables(transition.incoming, transition.outgoing)) {
    console.log("Early return: unbound output variables");
    return [];
  }

  if (hasMismatchedVariableTypes(transition.incoming, transition.outgoing)) {
    console.log("Early return: mismatched variable types");
    return [];
  }

  const arcPlaceInfoDict: ArcPlaceInfoDict = Object.fromEntries(
    transition.incoming.map((arc) => [arc.id, buildArcPlaceInfo(arc)]),
  );

  // For each arcPlaceInfo, check if there are tokens available, otherwise return no bindings
  if (!hasAvailableTokensForAllArcs(arcPlaceInfoDict)) {
    console.log("Early return: missing tokens in non-inhibitor arcs");
    return [];
  }

  const inhibitorTokens = getInhibitorTokens(arcPlaceInfoDict);
  console.log("Inhibitor tokens:", inhibitorTokens);

  // Step 1: get all links
  const links: AllLinks = getBiggestLinks(arcPlaceInfoDict);
  console.log("All links:", links);

  // Step 2: eliminate tokens blocked by inhibitors
  // TODO: now we should only remain with an arcPlaceInfoDict where tokens blocked by inhibitors are removed
  // Thus all remaining tokens are candidates for the respective arc

  // Step 3: compute arc-based cartesian product of all tokens of non-inhibitor, non-variable, non-linking arcs
  const singleBindingCandidates: Binding = [];
  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (arcPlaceInfo.isInhibitorArc || arcPlaceInfo.variableClass || arcPlaceInfo.isLinkingPlace) continue;
    // for all tokens of this arc, build tokens
    const tokenArray: Array<Token> = [];
    for (const token of arcPlaceInfo.token) {
      tokenArray.push(buildTokenFromTokenValue(token, arcPlaceInfo.dataClassInfoDict));
    }
    singleBindingCandidates.push(tokenArray);
  }
  const jointSingleBindingCandidates = cartesianProduct(singleBindingCandidates);
  console.log("Joint single binding candidates:", jointSingleBindingCandidates);

  // Step 4: delete bindings that do not satisfy links and join remaining bindings with link token
  const linkedBindingCandidates = getLinkedBindingCandidates(
    jointSingleBindingCandidates,
    links,
    arcPlaceInfoDict,
  );
  console.log("Linked binding candidates:", linkedBindingCandidates);

  // Step 5: extend bindings with variable arcs 


  // Build binding candidates for each non-inhibitor arc
  // const allArcBindingCandidates: Array<ArcBindingCandidates> = [];

  // for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
  //   if (arcPlaceInfo.isInhibitorArc) continue;

  //   // More concise version than down below where we iterate over all tokens
  //   // const bindingCandidates: ArcBindingCandidates = arcPlaceInfo.token
  //   //   .filter((token) => !isTokenBlockedByInhibitor(token, inhibitorTokens)) // Skip tokens blocked by inhibitor arcs
  //   //   .map((token) =>
  //   //     buildBindingFromToken(token, arcPlaceInfo.dataClassInfoDict),
  //   //   );

  //   const bindingCandidates: ArcBindingCandidates = [];
  //   for (const token of arcPlaceInfo.token) {
  //     // Skip tokens blocked by inhibitor arcs
  //     // TODO: In the discussed example it should print that token Item_1 and (Order_1, Item_1) are blocked by inhibitor token Item_1
  //     // Currently only prints token Item_1 and Item_1
  //     if (isTokenBlockedByInhibitor(token, inhibitorTokens)) {
  //       console.log("Skipping token blocked by inhibitor arc:", token);
  //       continue;
  //     }

  //     // Build binding from token
  //     const binding: Binding = buildBindingFromToken(
  //       token,
  //       arcPlaceInfo.dataClassInfoDict,
  //     );
  //     bindingCandidates.push(binding);
  //   } // End for token

  //   if (bindingCandidates.length === 0) {
  //     return [];
  //   }

  //   allArcBindingCandidates.push(bindingCandidates);
  // } // End for arcPlaceInfo

  // console.log("allArcBindingCandidates", allArcBindingCandidates);
  return jointSingleBindingCandidates // cartesianProduct(allArcBindingCandidates);
}

export function transitionIsEnabled(transition: Transition): boolean {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}
