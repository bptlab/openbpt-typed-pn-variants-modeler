import { buildArcPlaceInfoDict, getBindingPerDataClassFromNonLinkingArcs } from "./bindingUtilsArcPlaceInfoLogic";
import { hasAvailableTokensForAllArcs, hasMismatchedVariableTypes, hasUnboundOutputVariables } from "./bindingUtilsEarlyReturnLogic";
import { cartesianProductBindings, getBiggestLinks, getBindingsForLink, getDataClassesNotInLinks, getTokenPerLink } from "./bindingUtilsLinkingLogic";

export function getValidInputBindings(transition: Transition): BindingPerDataClass[] {  
  // Early return: unbound output variables
  if (hasUnboundOutputVariables(transition.incoming, transition.outgoing)) {
    console.log("Transition has unbound output variables.");
    return [];
  }
  
  // Early return: mismatched variable types
  if (hasMismatchedVariableTypes(transition.incoming, transition.outgoing)) {
    console.log("Transition has mismatched variable types.");
    return [];
  }
  
  // Step 1: build arcPlaceInfoDict and tokenStructure
  const arcPlaceInfoDict = buildArcPlaceInfoDict(transition.incoming);
  
  // Early return: missing tokens in non-inhibitor arcs
  if (!hasAvailableTokensForAllArcs(arcPlaceInfoDict)) {
    return [];
  }
  
  // Step 2: get biggest exclusive links, link tokens per place, placeId per dataClass alias
  const [biggestLinks, allLinks] = getBiggestLinks(arcPlaceInfoDict);
  const tokenPerLink = getTokenPerLink(arcPlaceInfoDict);
  
  // Step 3: compute bindings
  const bindingPerDataClassFromNonLinkingArcs = getBindingPerDataClassFromNonLinkingArcs(arcPlaceInfoDict); 

  if (biggestLinks.length == 0) {
    // Step 3.1: no links exist, return only bindings from non-linking arcs
    return [bindingPerDataClassFromNonLinkingArcs];
  }
  else {
    // Step 3.2: links exist, return only bindings that satisfy the links (together with TokenStructure)

    const bindingCandidatesPerLink: BindingPerDataClass[][] = [];
    for (const link of biggestLinks) {
      // each bindingCandidatesPerLink is a BindingPerDataClass for one link
      // and only contains bindings for data classes used in that link 
      const bindings = getBindingsForLink(link, allLinks, tokenPerLink, bindingPerDataClassFromNonLinkingArcs);
      bindingCandidatesPerLink.push(bindings); 
    }

    // lastly, push all token of arcs which data classes are not used in any link
    const dataClassesNotInLinks = getDataClassesNotInLinks(bindingPerDataClassFromNonLinkingArcs, biggestLinks);
    
    if (dataClassesNotInLinks.size > 0) {
      const bindingForNonLinkingDataClasses: BindingPerDataClass = {};
      dataClassesNotInLinks.forEach(dataClassKey => {
        bindingForNonLinkingDataClasses[dataClassKey] = bindingPerDataClassFromNonLinkingArcs[dataClassKey];
      });
      bindingCandidatesPerLink.push([bindingForNonLinkingDataClasses]);
    }
    // Create Cartesian product of all bindingCandidatesPerLink
    console.log("Transition:", transition.id);
    console.log("Valid Binding:", cartesianProductBindings(bindingCandidatesPerLink));
    return cartesianProductBindings(bindingCandidatesPerLink);
  }

  // Step X: eliminate tokens blocked by inhibitors
  // TODO: now we should only remain with an arcPlaceInfoDict where tokens blocked by inhibitors are removed
  // Thus all remaining tokens are candidates for the respective arc
  // const inhibitorTokens = getInhibitorTokens(arcPlaceInfoDict);
}


export function transitionIsEnabled(transition: Transition): boolean {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}



 // --------------------------------------------
  // Legacy code for reference
  // --------------------------------------------

  // // Step 3: compute arc-based cartesian product of all tokens of non-inhibitor, non-variable, non-linking arcs
  // const singleBindingCandidates: Binding = [];
  // for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
  //   if (arcPlaceInfo.isInhibitorArc || arcPlaceInfo.variableClass || arcPlaceInfo.isLinkingPlace) continue;
  //   singleBindingCandidates.push(arcPlaceInfo.tokens);
  // }
  // const jointSingleBindingCandidates = cartesianProduct(singleBindingCandidates);
  // console.log("Joint single binding candidates:", jointSingleBindingCandidates);
  // // [[I1],[O1]], [[I2],[O1]], [[I1],[O2]], [[I2],[O2]]
  
  // // Step 4: delete bindings that do not satisfy links and join remaining bindings with link token
  // const linkedBindingCandidates = getLinkedBindingCandidates(
  //   jointSingleBindingCandidates,
  //   linkTokenPerPlace, // I1,O1,C1, I2,O2,C1
  //   placeIdPerDataClassAlias,
  //   biggestLinks,
  //   arcPlaceInfoDict,
  // );
  // console.log("Linked binding candidates:", linkedBindingCandidates); // [I1],[O1],[{I1,O1,C1}{I1,O1,C2}]
  
  // // Step 5: extend bindings with non-linking variable arcs 
  // const finalBindingCandidates = getFinalBindingCandidates(
  //   linkedBindingCandidates,
  //   arcPlaceInfoDict,
  // );
  // console.log("Final binding candidates:", finalBindingCandidates); // [[{I: I1}],[{O:O1}}],[{I:I1,C:C1}{I:I1,C:C2}],[[C1,C2]]]
  // // --> Binding: [[{I: I1}],[O1],[{I1,C1}{I1,C2}]] + Backlog token: [[C1,C2]]
  // // TODO: introduce dependency from potential variable link bindings to non-linking variable bindings

  // // Step 6: return bindings as OutputToken
  // const outputBindings = createOutputBindings(finalBindingCandidates);
  // console.log("Output bindings:", outputBindings);
  // return outputBindings;

  
  
  
  
  
//   function cartesianProduct(arrays: Binding): Binding[] {
//   // We want the cartesian product to return an array of arrays of Token,
//   // where each inner array contains one Token from one input array.
//   // The second inner array contains the product combinations.
//   // As we want all product combinations, we need an Array of Binding as output.
//   // For example, input: [[{I: "Item_1"}], [{O: "Order_3"}, {O: "Order_4"}]]
//   // Output: [ [ [{I: "Item_1"}], [{O: "Order_3"}] ], [ [{I: "Item_1"}], [{O: "Order_4"}] ] ]
//   if (arrays.length === 0) return [];
//   if (arrays.length === 1) return arrays[0].map(item => [[item]]);

//   const result: Binding[] = [];

//   function helper(current: Token[][], depth: number) {
//     if (depth === arrays.length) {
//       result.push(current.map(arr => arr));
//       return;
//     }
//     for (const item of arrays[depth]) {
//       helper([...current, [item]], depth + 1);
//     }
//   }

//   helper([], 0);
//   return result;
// }

// function getLinkedBindingCandidates(
//   jointSingleBindingCandidates: Binding[],
//   linkTokenPerPlace: LinkTokenPerPlace,
//   placeIdPerLabelDataClass: { [key: string]: string[] },
//   biggestLinks: Link[],
//   arcPlaceInfoDict: ArcPlaceInfoDict,
// ): Binding[] {
//   if (Object.keys(linkTokenPerPlace).length === 0) {
//     return jointSingleBindingCandidates;
//   }

//   const linkedBindingCandidates: Binding[] = [];
  
//   if (jointSingleBindingCandidates.length == 0) {
//     // Special case: only one linking arc: Return its tokens as bindings
//     if (Object.keys(linkTokenPerPlace).length === 1) {
//       return arcPlaceInfoDict[Object.keys(arcPlaceInfoDict)[0]].tokens.map(token => [[token]]);
//     }
//     else {
//       //return createLinkBindingPerPlace(linkTokenPerPlace, placeIdPerLabelDataClass)[0];
//     }
//   }
//   else {
//     // TODO: Check that all linkTokenPerPlace are exclusive in terms of dataClasses used
//     // if not, create new linkToken combinations that satisfy all linkTokenPerPlace simultaneously
//     // let [linkBindingPerPlace, placeIdPerLabelDataClass] = createLinkBindingPerPlace(linkTokenPerPlace, placeIdPerLabelDataClass);
    

//     // For each joint binding candidate, check if any link token matches. 
//     // If so, keep the binding candidate and extend it with the link token.
//     for (const bindingCandidate of jointSingleBindingCandidates) {
      
//       const interestingLinkTokenPerPlace: LinkTokenPerPlace = {};
//       for (const arc of bindingCandidate) {
//         for (const token of arc) {
//           for (const tokenValue of token) {
//             const key = `${tokenValue.dataClass.alias}::${tokenValue.dataClass.id}`;
//             (placeIdPerLabelDataClass[key] ?? []).forEach(placeId => {
//               if (linkTokenPerPlace[placeId]) {
//                 interestingLinkTokenPerPlace[placeId] = linkTokenPerPlace[placeId];
//               }
//             });
//           }
//         }
//       }

//       console.log("Binding Candidate:", bindingCandidate, "Interesting link tokens for binding candidate:", interestingLinkTokenPerPlace);
      
//       for (const placeId in interestingLinkTokenPerPlace) {
//         const linkTokensToAdd: Token[] = [];
//         for (const linkToken of interestingLinkTokenPerPlace[placeId]) {

//           // Check if linkToken contains all token values from bindingCandidate
//           // Get unique token values from bindingCandidate
//           const bindingTokenValues = new Set<string>();
//           for (const arc of bindingCandidate) {
//             for (const token of arc) {
//               for (const tv of token) {
//                 bindingTokenValues.add(`${tv.dataClass.id}::${tv.dataClass.alias}::${tv.value}`);
//               }
//             }
//           }

//           // Check if all bindingTokenValues are represented in linkToken
//           let allTokensRepresented = true;
//           for (const item of bindingTokenValues) {
//             if (!linkToken.token.some(tv => `${tv.dataClass.id}::${tv.dataClass.alias}::${tv.value}` === item)) {
//               allTokensRepresented = false;
//               break;
//             }
//           }

//           // If all tokens are represented, we can add the linkToken to the binding candidate (depending on variableType)
//           if (allTokensRepresented) {
//             if (linkToken.variableType) {
//               linkTokensToAdd.push(linkToken.token);
//             }
//             else {
//               // Not variable: Create new binding candidate extended with only one linkToken
//               const newBindingCandidate: Binding = bindingCandidate.map(arc => arc.slice());
//               newBindingCandidate.push([linkToken.token]);
//               linkedBindingCandidates.push(newBindingCandidate);
//             }
//           }
//         }
//         if (linkTokensToAdd.length > 0) {
//           // Variable: Create new binding candidate extended with all linkTokensToAdd
//           const newBindingCandidate: Binding = bindingCandidate.map(arc => arc.slice());
//           newBindingCandidate.push(linkTokensToAdd);
//           linkedBindingCandidates.push(newBindingCandidate);
//         }
//       }
//     }
//   }

//   return linkedBindingCandidates;
// }

// function createLinkBindingPerPlace(
//   linkTokenPerPlace: LinkTokenPerPlace,
//   placeIdPerLabelDataClass: { [key: string]: string[] },
//   biggestLinks: Link[],
// ): [{ [key: string]: LinkToken[][][] }, { [key: string]: string[] }] {
//   const linkBindingPerPlace: { [key: string]: LinkToken[][][] } = {};
//   const updatedPlaceIdPerLabelDataClass = {...placeIdPerLabelDataClass};

//   for (const link of biggestLinks) {
//     // Find all placeIds for this link
//     const labelIdKeys = link.map(l => `${l.alias}::${l.id}`);

//     const placeIds = new Set(
//       labelIdKeys
//       .map(key => placeIdPerLabelDataClass[key] || [])
//       .flat()
//     );

//     const tokenToJoin = placeIds.size > 0 ? Array.from(placeIds).map(placeId => linkTokenPerPlace[placeId] || []) : [];
//     // TODO: implement joinLinkTokens
//     // const joinedLinkTokens = joinLinkTokens(tokenToJoin); 

//     const newPlaceId = link.map(l => `${l.id}:${l.alias}`).join("::");
//     // linkBindingPerPlace[newPlaceId] = joinedLinkTokens;

//     labelIdKeys.forEach(key => {
//       updatedPlaceIdPerLabelDataClass[key] = [newPlaceId];
//     });
//   }

//   return [linkBindingPerPlace, updatedPlaceIdPerLabelDataClass];
// }



// function createOutputBindings(
//   outputBindingCandidates: Binding[],
// ): OutputBinding[] {
//   const outputBindings: OutputBinding[] = [];

//   for (const bindingCandidate of outputBindingCandidates) {
//     const outputBinding: OutputBinding = [];
//     for (const tokenArray of bindingCandidate) {
//       const outputTokenArray: OutputToken[] = [];
//       for (const token of tokenArray) {
//         const outputToken: OutputToken = {};
//         for (const tokenValue of token) {
//           outputToken[tokenValue.dataClass.alias] = tokenValue.value;
//         }
//         outputTokenArray.push(outputToken);
//       }
//       outputBinding.push(outputTokenArray);
//     }
//     outputBindings.push(outputBinding);
//   }

//   return outputBindings;
// }

// function getFinalBindingCandidates(
//   linkedBindingCandidates: Binding[],
//   arcPlaceInfoDict: ArcPlaceInfoDict,
// ): Binding[] {
//   const finalBindingCandidates: Binding[] = [];

//   for (const bindingCandidate of linkedBindingCandidates) {
//     const extendedBindingCandidate: Binding = bindingCandidate.map(arc => arc.slice());

//     // For each arcPlaceInfo, check if variableClass is defined and not linking place
//     for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
//       if (arcPlaceInfo.isInhibitorArc || arcPlaceInfo.isLinkingPlace || !arcPlaceInfo.variableClass) continue;

//       // Get all tokens from arcPlaceInfo that match the variableClass
//       const matchingTokens: Token[] = [];
//       for (const token of arcPlaceInfo.tokens) {
//         const allTokenValuesMatch = token.every(tv => 
//           bindingCandidate.some(arc => 
//             arc.some(candidateToken => 
//               candidateToken.some(candidateTokenValue =>
//                 candidateTokenValue.dataClass.id === tv.dataClass.id &&
//                 candidateTokenValue.dataClass.alias === tv.dataClass.alias &&
//                 candidateTokenValue.value === tv.value
//               )
//             )
//           )
//         );
//         if (allTokenValuesMatch) {
//           matchingTokens.push(token);
//         }
//       }

//       // Extend the binding candidate with the matching tokens
//       extendedBindingCandidate.push(matchingTokens);
//     }

//     finalBindingCandidates.push(extendedBindingCandidate);
//   }

//   return finalBindingCandidates;
// }