import {
  buildArcPlaceInfoDict,
  getBindingPerDataClassFromNonLinkingArcs,
} from "./bindingUtilsArcPlaceInfoLogic";
import {
  hasAvailableTokensForAllArcs,
  hasMismatchedVariableTypes,
  hasUnboundOutputVariables,
} from "./bindingUtilsEarlyReturnLogic";
import { checkExactSynchroConstraints } from "./bindingUtilsExactSynchro";
import {
  cartesianProductBindings,
  getBiggestLinks,
  getBindingsForLink,
  getDataClassesNotInLinks,
  getTokenPerLink,
} from "./bindingUtilsLinkingLogic";

export function getValidInputBindings(
  transition: Transition,
): BindingPerDataClass[] {
  let validInputBindings: BindingPerDataClass[];

  // Early return: unbound output variables
  if (hasUnboundOutputVariables(transition.incoming, transition.outgoing)) {
    // console.log("Transition ${transition.id} has unbound output variables.");
    return [];
  }

  // Early return: mismatched variable types
  if (hasMismatchedVariableTypes(transition.incoming, transition.outgoing)) {
    // console.log("Transition ${transition.id} has mismatched variable types.");
    return [];
  }

  // Step 1: build arcPlaceInfoDict and tokenStructure
  const arcPlaceInfoDict = buildArcPlaceInfoDict(transition.incoming);

  // Early return: missing tokens in non-inhibitor arcs
  if (!hasAvailableTokensForAllArcs(arcPlaceInfoDict)) {
    // console.log("Transition ${transition.id} has missing tokens in non-inhibitor arcs.");
    return [];
  }

  // Step 2: get biggest exclusive links, link tokens per place, placeId per dataClass alias
  const [biggestLinks, allLinks] = getBiggestLinks(arcPlaceInfoDict);
  const tokenPerLink = getTokenPerLink(arcPlaceInfoDict);

  // Step 3: compute bindings
  const bindingPerDataClassFromNonLinkingArcs =
    getBindingPerDataClassFromNonLinkingArcs(arcPlaceInfoDict);

  if (biggestLinks.length == 0) {
    // Step 3.1: no links exist, return only bindings from non-linking arcs
    // if there are no incoming arcs, return empty binding
    validInputBindings = [bindingPerDataClassFromNonLinkingArcs];
  } else {
    // Step 3.2: links exist, return only bindings that satisfy the links
    const bindingCandidatesPerLink: BindingPerDataClass[][] = [];

    for (const link of biggestLinks) {
      // each bindingCandidatesPerLink is a BindingPerDataClass for one link
      // and only contains bindings for data classes used in that link
      const bindingCandidate = getBindingsForLink(
        link,
        allLinks,
        tokenPerLink,
        bindingPerDataClassFromNonLinkingArcs,
      );
      bindingCandidatesPerLink.push(bindingCandidate);
    }

    // lastly, push all token of arcs which data classes are not used in any link
    const dataClassesNotInLinks = getDataClassesNotInLinks(
      bindingPerDataClassFromNonLinkingArcs,
      biggestLinks,
    );

    if (dataClassesNotInLinks.size > 0) {
      const bindingForNonLinkingDataClasses: BindingPerDataClass = {};
      dataClassesNotInLinks.forEach((dataClassKey) => {
        bindingForNonLinkingDataClasses[dataClassKey] =
          bindingPerDataClassFromNonLinkingArcs[dataClassKey];
      });
      bindingCandidatesPerLink.push([bindingForNonLinkingDataClasses]);
    }
    // Create Cartesian product of all bindingCandidatesPerLink
    validInputBindings = cartesianProductBindings(bindingCandidatesPerLink);
  }

  console.log("before inhibtor arc");
  console.log(validInputBindings);
  
  // TODO: implement inhibitor arc logic to remove blocked bindings
  // Step 4: eliminate bindings blocked by inhibitors
  // if inhibitor dataclasses do not exist, inhibitor arc can be skipped
  // build biggest links
  // if biggest links already exist, remove tokens
  
  // Example: [I: 1,2,3, O: 1,2,3]
  // inhibitor arcs: I2,O3 + I2,O2
  
  // My idea: same logic as links: find biggest inhibitor links, compute inhibitor bindings per inhibitor link
  // Then treat them like normal links (which means only one value per non variable arc per binding)
  // and remove bindings that match any inhibitor binding
  // -> output: [I: 1, O: 1], [I: 1, O: 2], [I: 1, O: 3], [I: 2, O: 1], [I: 3, O: 1], [I: 3, O: 2], [I: 3, O: 3]
  
  // Step 5: check for ExactSubsetSynchro constraint
  console.log("Transition", transition.id);
  validInputBindings = checkExactSynchroConstraints(
    arcPlaceInfoDict,
    validInputBindings,
  );

  return validInputBindings;
}

export function transitionIsEnabled(transition: Transition): boolean {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}
