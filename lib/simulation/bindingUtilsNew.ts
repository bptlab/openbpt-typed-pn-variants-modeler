import { getBiggestLinks } from "./bindingUtilsHelpers";


// ArcBindingCandidates: All possible bindings for one arc
// type ArcBindingCandidates = Binding[];

// ValidBindings: All valid complete bindings for a transition
// (chooses one binding from each ArcBindingsCandidates per arc)
// type ValidBindings = Binding[];

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
        variableClass = {id: dataClass.id, label: dataClass.alias}; // this alias is something we need, which is not represented in modelSchemaTypes.ts
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
      .map((el: any) => el.variableName), // el should be InscriptionElement[]/Inscription
  );

  return outgoingArcs
    .filter((arc) => !arc.businessObject.isInhibitorArc)
    .some((arc) => {
      const inscriptionElements =
        arc.businessObject.inscription?.inscriptionElements || [];
      return inscriptionElements.some(
        (el: any) => // el should be InscriptionElement
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
    const varName: string = inscriptionElements.find((elem: any) => elem.dataClass.id === dataClassId)?.variableName ?? "";
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

function getAllLinkToken(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): LinkTokenPerPlace {
  const linkTokenPerPlace: LinkTokenPerPlace = {};

  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isLinkingPlace) continue;

    const linkTokens: LinkToken[] = [];
    for (const token of arcPlaceInfo.tokens) {
      linkTokens.push({
      variableType: arcPlaceInfo.variableClass,
      values: token,
      });
    }

    linkTokenPerPlace[arcPlaceInfo.placeId] = linkTokens;
  }

  return linkTokenPerPlace;
}

function getPlaceIdPerLabelDataClass(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): { [key: string]: string[] } {
  const placeIdPerLabelDataClass: { [key: string]: string[] } = {};
  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (arcPlaceInfo.isLinkingPlace) {
      const linkId = arcPlaceInfo.placeId;
      // Build a mapping from label and dataClassId to linkId
      for (const [dataClassId, dataClassInfo] of Object.entries(arcPlaceInfo.dataClassInfoDict)) {
        const key = `${dataClassInfo.label}::${dataClassId}`;
        if (!placeIdPerLabelDataClass[key]) {
          placeIdPerLabelDataClass[key] = [];
        }
        placeIdPerLabelDataClass[key].push(linkId);
      }
    }
  }
  return placeIdPerLabelDataClass;
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
  linkTokenPerPlace: LinkTokenPerPlace,
  placeIdPerLabelDataClass: { [key: string]: string[] },
  biggestLinks: Link[],
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Binding[] {
  if (Object.keys(linkTokenPerPlace).length === 0) {
    return jointSingleBindingCandidates;
  }

  const linkedBindingCandidates: Binding[] = [];
  
  if (jointSingleBindingCandidates.length == 0) {
    // Special case: only one linking arc: Return its tokens as bindings
    if (Object.keys(linkTokenPerPlace).length === 1) {
      return arcPlaceInfoDict[Object.keys(arcPlaceInfoDict)[0]].tokens.map(token => [[token]]);
    }
    else {
      //return createLinkBindingPerPlace(linkTokenPerPlace, placeIdPerLabelDataClass)[0];
    }
  }
  else {
    // TODO: Check that all linkTokenPerPlace are exclusive in terms of dataClasses used
    // if not, create new linkToken combinations that satisfy all linkTokenPerPlace simultaneously
    // let [linkBindingPerPlace, placeIdPerLabelDataClass] = createLinkBindingPerPlace(linkTokenPerPlace, placeIdPerLabelDataClass);
    

    // For each joint binding candidate, check if any link token matches. 
    // If so, keep the binding candidate and extend it with the link token.
    for (const bindingCandidate of jointSingleBindingCandidates) {
      
      const interestingLinkTokenPerPlace: LinkTokenPerPlace = {};
      for (const arc of bindingCandidate) {
        for (const token of arc) {
          for (const tokenValue of token) {
            const key = `${tokenValue.dataClass.label}::${tokenValue.dataClass.id}`;
            (placeIdPerLabelDataClass[key] ?? []).forEach(placeId => {
              if (linkTokenPerPlace[placeId]) {
                interestingLinkTokenPerPlace[placeId] = linkTokenPerPlace[placeId];
              }
            });
          }
        }
      }

      console.log("Binding Candidate:", bindingCandidate, "Interesting link tokens for binding candidate:", interestingLinkTokenPerPlace);
      
      for (const placeId in interestingLinkTokenPerPlace) {
        const linkTokensToAdd: Token[] = [];
        for (const linkToken of interestingLinkTokenPerPlace[placeId]) {

          // Check if linkToken contains all token values from bindingCandidate
          // Get unique token values from bindingCandidate
          const bindingTokenValues = new Set<string>();
          for (const arc of bindingCandidate) {
            for (const token of arc) {
              for (const tv of token) {
                bindingTokenValues.add(`${tv.dataClass.id}::${tv.dataClass.label}::${tv.value}`);
              }
            }
          }

          // Check if all bindingTokenValues are represented in linkToken
          let allTokensRepresented = true;
          for (const item of bindingTokenValues) {
            if (!linkToken.values.some(tv => `${tv.dataClass.id}::${tv.dataClass.label}::${tv.value}` === item)) {
              allTokensRepresented = false;
              break;
            }
          }

          // If all tokens are represented, we can add the linkToken to the binding candidate (depending on variableType)
          if (allTokensRepresented) {
            if (linkToken.variableType) {
              linkTokensToAdd.push(linkToken.values);
            }
            else {
              // Not variable: Create new binding candidate extended with only one linkToken
              const newBindingCandidate: Binding = bindingCandidate.map(arc => arc.slice());
              newBindingCandidate.push([linkToken.values]);
              linkedBindingCandidates.push(newBindingCandidate);
            }
          }
        }
        if (linkTokensToAdd.length > 0) {
          // Variable: Create new binding candidate extended with all linkTokensToAdd
          const newBindingCandidate: Binding = bindingCandidate.map(arc => arc.slice());
          newBindingCandidate.push(linkTokensToAdd);
          linkedBindingCandidates.push(newBindingCandidate);
        }
      }
    }
  }

  return linkedBindingCandidates;
}

function createLinkBindingPerPlace(
  linkTokenPerPlace: LinkTokenPerPlace,
  placeIdPerLabelDataClass: { [key: string]: string[] },
  biggestLinks: Link[],
): [{ [key: string]: LinkToken[][][] }, { [key: string]: string[] }] {
  const linkBindingPerPlace: { [key: string]: LinkToken[][][] } = {};
  const updatedPlaceIdPerLabelDataClass = {...placeIdPerLabelDataClass};

  for (const link of biggestLinks) {
    // Find all placeIds for this link
    const labelIdKeys = link.map(l => `${l.label}::${l.id}`);

    const placeIds = new Set(
      labelIdKeys
      .map(key => placeIdPerLabelDataClass[key] || [])
      .flat()
    );

    const tokenToJoin = placeIds.size > 0 ? Array.from(placeIds).map(placeId => linkTokenPerPlace[placeId] || []) : [];
    // TODO: implement joinLinkTokens
    // const joinedLinkTokens = joinLinkTokens(tokenToJoin); 

    const newPlaceId = link.map(l => `${l.id}:${l.label}`).join("::");
    // linkBindingPerPlace[newPlaceId] = joinedLinkTokens;

    labelIdKeys.forEach(key => {
      updatedPlaceIdPerLabelDataClass[key] = [newPlaceId];
    });
  }

  return [linkBindingPerPlace, updatedPlaceIdPerLabelDataClass];
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

function getFinalBindingCandidates(
  linkedBindingCandidates: Binding[],
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Binding[] {
  const finalBindingCandidates: Binding[] = [];

  for (const bindingCandidate of linkedBindingCandidates) {
    const extendedBindingCandidate: Binding = bindingCandidate.map(arc => arc.slice());

    // For each arcPlaceInfo, check if variableClass is defined and not linking place
    for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
      if (arcPlaceInfo.isInhibitorArc || arcPlaceInfo.isLinkingPlace || !arcPlaceInfo.variableClass) continue;

      // Get all tokens from arcPlaceInfo that match the variableClass
      const matchingTokens: Token[] = [];
      for (const token of arcPlaceInfo.tokens) {
        const allTokenValuesMatch = token.every(tv => 
          bindingCandidate.some(arc => 
            arc.some(candidateToken => 
              candidateToken.some(candidateTokenValue =>
                candidateTokenValue.dataClass.id === tv.dataClass.id &&
                candidateTokenValue.dataClass.label === tv.dataClass.label &&
                candidateTokenValue.value === tv.value
              )
            )
          )
        );
        if (allTokenValuesMatch) {
          matchingTokens.push(token);
        }
      }

      // Extend the binding candidate with the matching tokens
      extendedBindingCandidate.push(matchingTokens);
    }

    finalBindingCandidates.push(extendedBindingCandidate);
  }

  return finalBindingCandidates;
}

export function getValidInputBindings(transition: Transition): OutputBinding[] {
  console.log("Transition:", transition.id);

  // If no incoming arcs, transition is always enabled
  if (transition.incoming.length === 0) {
    return [[]]; // For consistency, return array with one empty binding
  }

  // Early return: unbound output variables
  if (hasUnboundOutputVariables(transition.incoming, transition.outgoing)) {
    return [];
  }

  // Early return: mismatched variable types
  if (hasMismatchedVariableTypes(transition.incoming, transition.outgoing)) {
    return [];
  }

  const arcPlaceInfoDict: ArcPlaceInfoDict = Object.fromEntries(
    transition.incoming.map((arc) => [arc.id, buildArcPlaceInfo(arc)]),
  );
  console.log("ArcPlaceInfoDict:", arcPlaceInfoDict);

  // Early return: missing tokens in non-inhibitor arcs
  if (!hasAvailableTokensForAllArcs(arcPlaceInfoDict)) {
    return [];
  }

  // const inhibitorTokens = getInhibitorTokens(arcPlaceInfoDict);
  // console.log("Inhibitor tokens:", inhibitorTokens);

  // Step 1: get all link tokens
  const biggestLinks = getBiggestLinks(arcPlaceInfoDict);
  const linkTokenPerPlace: LinkTokenPerPlace = getAllLinkToken(arcPlaceInfoDict);
  const placeIdPerLabelDataClass = getPlaceIdPerLabelDataClass(arcPlaceInfoDict);
  console.log("Link tokens per place:", linkTokenPerPlace);

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
    linkTokenPerPlace,
    placeIdPerLabelDataClass,
    biggestLinks,
    arcPlaceInfoDict,
  );
  console.log("Linked binding candidates:", linkedBindingCandidates);
  
  // Step 5: extend bindings with non-linking variable arcs 
  const finalBindingCandidates = getFinalBindingCandidates(
    linkedBindingCandidates,
    arcPlaceInfoDict,
  );
  console.log("Final binding candidates:", finalBindingCandidates);

  // Step 6: return bindings as OutputToken

  // TODO: introduce dependency from potential variable link bindings to non-linking variable bindings
  const outputBindings = createOutputBindings(finalBindingCandidates);
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
