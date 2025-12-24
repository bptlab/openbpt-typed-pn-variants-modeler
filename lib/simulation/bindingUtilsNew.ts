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