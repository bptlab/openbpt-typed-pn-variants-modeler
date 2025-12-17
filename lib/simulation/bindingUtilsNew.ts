// Token: An Array of TokenValue representing one token
type Token = TokenValue[];

// Binding: An Array of Token[] representing one possible binding
// Token[]: all possible token per arc, which are later choosable
type Binding = Token[][];
// type Binding = { [label: string]: string[] };

// Link: An array of id-label-pairs representing a link
type Link = DataClass[];


// OutputToken: A mapping from dataClass label to value that is used by FireTransitionHandler
type OutputToken = { [label: string]: string };

// OutputBinding: An array of OutputToken arrays representing one output binding
type OutputBinding = OutputToken[][];

// ArcBindingCandidates: All possible bindings for one arc
// type ArcBindingCandidates = Binding[];

// ValidBindings: All valid complete bindings for a transition
// (chooses one binding from each ArcBindingsCandidates per arc)
// type ValidBindings = Binding[];

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

  const customMarking: Token[] = [];
  for (const token of marking) {
    const tokenObj: Token = [];
    const tokenValues = token.values ?? [];
    for (const { dataClass, value } of tokenValues) {
      tokenObj.push({ dataClass: {label: dataClass.alias, id: dataClass.id}, value: value });
    }
    customMarking.push(tokenObj);
  }

  return {
    arcId: arc.id,
    placeId: place.id,
    tokens: customMarking,
    isInhibitorArc,
    isLinkingPlace: Object.keys(dataClassInfoDict).length > 1,
    variableClass,
    dataClassInfoDict,
  };
}

// Returns true if any output arc has a non-generated variable that was not defined in the input arcs
function hasUnboundOutputVariables(
  incomingArcs: Arc[],
  outgoingArcs: Arc[],
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
  incomingArcs: Arc[],
  outgoingArcs: Arc[],
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

function buildDataclassNameDictionary(arcs: Arc[]) {
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
      arcPlaceInfo.isInhibitorArc || arcPlaceInfo.tokens.length > 0,
  );
}

function getInhibitorTokens(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Token[] {
  const inhibitorTokens: Token[] = [];

  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isInhibitorArc) continue;

    inhibitorTokens.push(...arcPlaceInfo.tokens);
  }

  return inhibitorTokens;
}

function getBiggestLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Link[] {
  const allLinks: Link[] = getAllUniqueLinks(arcPlaceInfoDict);

  // Helper to check if linkA is a subset of linkB
  function linkIsSubset(linkA: Link, linkB: Link): boolean {
    const bSet = new Set(linkB.map(l => `${l.id}:${l.label}`));
    return linkA.every(l => bSet.has(`${l.id}:${l.label}`));
  }
  // Filter out links that are a subset of another link
  const biggestLinks = allLinks.filter((link, idx, arr) =>
    !arr.some((other, otherIdx) =>
      otherIdx !== idx && linkIsSubset(link, other) && other.length > link.length
    )
  );

  return biggestLinks;
}

function getAllUniqueLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Link[] {
  const allLinks: Link[] = [];

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

  const deduplicatedLinks = deduplicateLinks(allLinks);

  return deduplicatedLinks;
}

function deduplicateLinks(links: Link[]): Link[] {
  const uniqueLinks: Link[] = [];
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
  for (const link of links) {
    if (!uniqueLinks.some(existing => linksAreEqual(existing, link))) {
      uniqueLinks.push(link);
    }
  }
  return uniqueLinks;
}

function cartesianProduct(arrays: Binding): Binding[] {
  // We want the cartesian product to return an array of arrays of Token,
  // where each inner array contains one Token from one input array.
  // The second inner array contains the product combinations.
  // As we want all product combinations, we need an Array of Binding as output.
  // For example, input: [[{I: "Item_1"}], [{O: "Order_3"}, {O: "Order_4"}]]
  // Output: [ [ [{I: "Item_1"}], [{O: "Order_3"}] ], [ [{I: "Item_1"}], [{O: "Order_4"}] ] ]
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0].map(item => [[item]]);

  const result: Binding[] = [];

  function helper(current: Token[][], depth: number) {
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
  jointSingleBindingCandidates: Binding[],
  links: Link[],
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Binding[] {
  if (links.length === 0) {
    return jointSingleBindingCandidates;
  }

  const linkedBindingCandidates: Binding[] = [];
  
  if (jointSingleBindingCandidates.length > 0) {
    if (links.length > 1) {
      console.warn("Multiple links are not yet fully supported.");
      // TODO: Link links first
    }

    // gather all link tokens from arcPlaceInfoDict
    const linkTokensDict: { [linkId: string]: Token[] } = {};
    const linkLabelDataClassToLinkId: { [key: string]: string[] } = {};
    for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
      if (arcPlaceInfo.isLinkingPlace) {
        const linkId = arcPlaceInfo.arcId;
        linkTokensDict[linkId] = arcPlaceInfo.tokens;
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
      const interestingLinkTokens: Set<Token> = new Set();
      for (const arc of bindingCandidate) {
        for (const token of arc) {
          for (const tokenValue of token) {
            const key = `${tokenValue.dataClass.label}::${tokenValue.dataClass.id}`;
            (linkLabelDataClassToLinkId[key] ?? []).forEach(linkId => {
              linkTokensDict[linkId].forEach(linkToken => {
                interestingLinkTokens.add(linkToken);
              });
            });
          }
        }
      }
      console.log("Binding Candidate:", bindingCandidate, "Interesting link tokens for binding candidate:", interestingLinkTokens);
      for (const linkToken of interestingLinkTokens) {
        // Check if linkToken matches bindingCandidate
        let matches = true;
        for (const tokenValue of linkToken) {
          let tokenValueMatches = false;
          for (const arc of bindingCandidate) {
            for (const token of arc) {
              if (token.some(tv => tv.dataClass.id === tokenValue.dataClass.id && tv.value === tokenValue.value)) {
                tokenValueMatches = true;
                break;
              }
            }
            if (tokenValueMatches) break;
          }
          if (!tokenValueMatches) {
            matches = false;
            break;
          }
        }
        if (matches) {
          // Create new binding candidate extended with linkToken
          const newBindingCandidate: Binding = bindingCandidate.map(arc => arc.slice());
          newBindingCandidate.push([linkToken]);
          linkedBindingCandidates.push(newBindingCandidate);
        }
      }
    }
  }
  else {
    // Special case: only one linking arc: Return its tokens as bindings
    if (Object.keys(arcPlaceInfoDict).length === 1 && !arcPlaceInfoDict[Object.keys(arcPlaceInfoDict)[0]].isInhibitorArc) {
      return arcPlaceInfoDict[Object.keys(arcPlaceInfoDict)[0]].tokens.map(token => [[token]]);
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
  inhibitorTokens: TokenValue[],
): boolean {
  return inhibitorTokens.some((inhibitorToken) =>
    tokensEqual(token, inhibitorToken),
  );
}

function createOutputBindings(
  outputBindingCandidates: Binding[],
): OutputBinding[] {
  const outputBindings: OutputBinding[] = [];

  for (const bindingCandidate of outputBindingCandidates) {
    const outputBinding: OutputBinding = [];
    for (const tokenArray of bindingCandidate) {
      const outputTokenArray: OutputToken[] = [];
      for (const token of tokenArray) {
        const outputToken: OutputToken = {};
        for (const tokenValue of token) {
          outputToken[tokenValue.dataClass.label] = tokenValue.value;
        }
        outputTokenArray.push(outputToken);
      }
      outputBinding.push(outputTokenArray);
    }
    outputBindings.push(outputBinding);
  }

  return outputBindings;
}

// function buildTokenFromTokenValue(
//   token: Token,
//   dataClassInfoDict: { [dataClassId: string]: DataClassInfo },
// ): Token {
//   const tokenObj: Token = {} as Token;
//   for (const [dataClassId, dataClassInfo] of Object.entries(
//     dataClassInfoDict,
//   )) {
//     if (dataClassInfo.label && token.values.dataClass.id === dataClassId) {
//       tokenObj[dataClassInfo.label] = token.value;
//     }
//   }
//   return tokenObj;
// }

export function getValidInputBindings(transition: Transition): OutputBinding[] {
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
  console.log("ArcPlaceInfoDict:", arcPlaceInfoDict);

  // For each arcPlaceInfo, check if there are tokens available, otherwise return no bindings
  if (!hasAvailableTokensForAllArcs(arcPlaceInfoDict)) {
    console.log("Early return: missing tokens in non-inhibitor arcs");
    return [];
  }

  // const inhibitorTokens = getInhibitorTokens(arcPlaceInfoDict);
  // console.log("Inhibitor tokens:", inhibitorTokens);

  // Step 1: get all links
  const links: Link[] = getAllUniqueLinks(arcPlaceInfoDict) // getBiggestLinks(arcPlaceInfoDict);

  // Step 2: eliminate tokens blocked by inhibitors
  // TODO: now we should only remain with an arcPlaceInfoDict where tokens blocked by inhibitors are removed
  // Thus all remaining tokens are candidates for the respective arc

  // Step 3: compute arc-based cartesian product of all tokens of non-inhibitor, non-variable, non-linking arcs
  const singleBindingCandidates: Binding = [];
  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (arcPlaceInfo.isInhibitorArc || arcPlaceInfo.variableClass || arcPlaceInfo.isLinkingPlace) continue;
    singleBindingCandidates.push(arcPlaceInfo.tokens);
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


  // Step 6: return bindings as OutputToken
  const outputBindings = createOutputBindings(linkedBindingCandidates);
  console.log("Output bindings:", outputBindings);
  return outputBindings;


  // Build binding candidates for each non-inhibitor arc
  // const allArcBindingCandidates: ArcBindingCandidates[] = [];

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
  //return jointSingleBindingCandidates // cartesianProduct(allArcBindingCandidates);
}

export function transitionIsEnabled(transition: Transition): boolean {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}
