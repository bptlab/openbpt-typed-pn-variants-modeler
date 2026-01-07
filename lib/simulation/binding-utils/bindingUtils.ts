import {
  buildArcPlaceInfoDict,
  getBindingPerDataClassFromNonLinkingArcs,
} from "./bindingUtilsArcPlaceInfoLogic";
import {
  hasAvailableTokensForAllArcs,
  hasMismatchedVariableTypes,
  hasUnboundOutputVariables,
} from "./bindingUtilsEarlyReturnLogic";
import { getNonInhibitorArcs } from "./bindingUtilsHelper";
import { filterBindingsByInhibitors } from "./bindingUtilsInhibitorLogic";
import {
  cartesianProductBindings,
  expandBindings,
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
  const nonInhibitorArcs = getNonInhibitorArcs(arcPlaceInfoDict);

  const [biggestLinks, allLinks] = getBiggestLinks(nonInhibitorArcs);
  const tokenPerLink = getTokenPerLink(nonInhibitorArcs);

  // Step 3: compute bindings
  const bindingPerDataClassFromNonLinkingArcs =
    getBindingPerDataClassFromNonLinkingArcs(nonInhibitorArcs);

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

  // Step 3.3: Expand bindings to individual token combinations
  // This ensures each binding represents one specific firing option
  validInputBindings = expandBindings(validInputBindings);

  // Warn if expansion created too many bindings
  if (validInputBindings.length > 1000) {
    console.warn(
      `Transition ${transition.id} has ${validInputBindings.length} bindings. ` +
        `This may impact performance. Consider reducing variable arc token counts.`,
    );
  }

  console.log("Valid bindings before inhibitor", validInputBindings);

  // Step 4: eliminate bindings blocked by inhibitors
  validInputBindings = filterBindingsByInhibitors(
    validInputBindings,
    arcPlaceInfoDict,
  );

  console.log("Valid bindings after inhibitor", validInputBindings);

  // Step 5: check for ExactSubsetSynchro constraint
  // ** more magic **

  return validInputBindings;
}

export function transitionIsEnabled(transition: Transition): boolean {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}
