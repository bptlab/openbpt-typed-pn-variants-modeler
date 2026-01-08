import {
  getAllIncomingDataClassKeys,
  getBaseDataClassKey,
  getDataClassKey,
} from "./bindingUtilsHelper";
import {
  cartesianProductBindings,
  expandBindings,
  getBiggestLinks,
  getBindingsForLink,
  getTokenPerLink,
} from "./bindingUtilsLinkingLogic";

/**
 * Filters and returns only the inhibitor arcs from the provided arc-place information dictionary.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc-place identifiers to their corresponding information, including tokens and inhibitor status.
 * @returns A new dictionary containing only the entries where `isInhibitorArc` is `true`.
 */
function getInhibitorArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): ArcPlaceInfoDict {
  return Object.fromEntries(
    Object.entries(arcPlaceInfoDict).filter(
      ([_, arcPlaceInfo]) => arcPlaceInfo.isInhibitorArc,
    ),
  );
}

/**
 * Checks if an inhibitor arc has at least one data class that exists in the incoming arcs.
 *
 * @param arcPlaceInfo - The arc-place information to check.
 * @param incomingDataClassKeys - Set of all data class keys from incoming arcs (excluding inhibitor arcs).
 * @returns `true` if at least one data class from the arc exists in incoming arcs; otherwise, `false`.
 */ function hasRelevantDataClasses(
  arcPlaceInfo: ArcPlaceInfo,
  incomingDataClassKeys: Set<string>,
): boolean {
  const incomingBaseKeys = new Set(
    Array.from(incomingDataClassKeys).map(getBaseDataClassKey),
  );

  return Object.entries(arcPlaceInfo.dataClassInfoDict).some(
    ([dataClassId, dataClassInfo]) => {
      const baseKey = getBaseDataClassKey(
        getDataClassKey(
          dataClassId,
          dataClassInfo.alias,
          dataClassInfo.isVariable,
        ),
      );
      return incomingBaseKeys.has(baseKey);
    },
  );
}

/**
 * Generates all possible bindings from inhibitor arcs using the same link logic as regular arcs.
 * Expands the bindings to include all possible token combinations (including power sets for variables).
 *
 * @param relevantInhibitorArcs - Dictionary of inhibitor arcs that have data classes in common with incoming arcs.
 * @param incomingDataClassKeys - Set of all data class keys from incoming arcs.
 * @returns Array of expanded bindings that represent blocked combinations.
 */
function getInhibitorBindings(
  relevantInhibitorArcs: ArcPlaceInfoDict,
  incomingDataClassKeys: Set<string>,
): BindingPerDataClass[] {
  const [biggestInhibitorLinks, allInhibitorLinks] = getBiggestLinks(
    relevantInhibitorArcs,
  );

  let inhibitorBindings: BindingPerDataClass[];

  if (biggestInhibitorLinks.length === 0) {
    // No links in inhibitor arcs - treat each arc independently
    inhibitorBindings = [];

    // TODO: Ask Max if inhibitor bindings should include differentiation between variable arcs or not
    const incomingBaseKeys = new Set(
      Array.from(incomingDataClassKeys).map(getBaseDataClassKey),
    );

    for (const arcPlaceInfo of Object.values(relevantInhibitorArcs)) {
      for (const token of arcPlaceInfo.tokens) {
        const filteredToken: BindingPerDataClass = {};
        for (const [dataClassKey, value] of Object.entries(token)) {
          const baseKey = getBaseDataClassKey(dataClassKey);

          if (incomingBaseKeys.has(baseKey)) {
            filteredToken[dataClassKey] = [value];
          }
        }

        if (Object.keys(filteredToken).length > 0) {
          inhibitorBindings.push(filteredToken);
        }
      }
    }
  } else {
    // Links exist - use link logic
    const tokenPerInhibitorLink = getTokenPerLink(relevantInhibitorArcs);
    const inhibitorBindingCandidatesPerLink: BindingPerDataClass[][] = [];

    for (const link of biggestInhibitorLinks) {
      const bindingCandidate = getBindingsForLink(
        link,
        allInhibitorLinks,
        tokenPerInhibitorLink,
        {},
      );
      inhibitorBindingCandidatesPerLink.push(bindingCandidate);
    }

    inhibitorBindings = cartesianProductBindings(
      inhibitorBindingCandidatesPerLink,
    );
  }

  // IMPORTANT: Expand inhibitor bindings just like regular bindings
  // This ensures variable arcs create all possible subset combinations
  inhibitorBindings = expandBindings(inhibitorBindings);

  return inhibitorBindings;
}

/**
 * Checks if an expanded binding is blocked by any inhibitor binding.
 * A binding is blocked if it contains ALL values from ALL data classes in the inhibitor.
 * For variable data classes with multiple values (e.g., ['A', 'B']), the binding is blocked
 * if it's a superset of the inhibitor values.
 *
 * @param binding - An expanded binding. Non-variable data classes have one value,
 *                  variable data classes may have multiple values (subsets from power set).
 * @param inhibitorBindings - Array of inhibitor bindings that represent blocked combinations.
 * @returns `true` if blocked; otherwise `false`.
 *
 * @example Non-variable blocking
 * binding = {"I:false": ["1"], "O:false": ["2"]}
 * inhibitor = {"I:false": ["1"], "O:false": ["2"]}
 * Returns: true (exact match on all data classes)
 *
 * @example Variable arc - blocked because contains B
 * binding = {"I:false": ["1"], "O:true": ["A", "B", "C"]}
 * inhibitor = {"I:false": ["1"], "O:true": ["B"]}
 * Returns: true (binding contains all inhibitor values: B is in [A,B,C])
 *
 * @example Variable arc - not blocked
 * binding = {"I:false": ["1"], "O:true": ["A", "C"]}
 * inhibitor = {"I:false": ["1"], "O:true": ["B"]}
 * Returns: false (binding doesn't contain B)
 *
 * @example Partial match doesn't block
 * binding = {"I:false": ["1"], "O:false": ["3"]}
 * inhibitor = {"I:false": ["1"], "O:false": ["2"]}
 * Returns: false (O values don't match)
 */
function isBindingBlocked(
  binding: BindingPerDataClass,
  inhibitorBindings: BindingPerDataClass[],
): boolean {
  return inhibitorBindings.some((inhibitorBinding) => {
    // Check if ALL data classes in the inhibitor match the binding
    return Object.entries(inhibitorBinding).every(
      ([inhibitorDataClassKey, inhibitorValues]) => {
        const inhibitorBaseKey = getBaseDataClassKey(inhibitorDataClassKey);

        // Find matching data class in binding (could be variable or non-variable)
        const matchingBindingKey = Object.keys(binding).find(
          (bindingKey) => getBaseDataClassKey(bindingKey) === inhibitorBaseKey,
        );

        // If binding doesn't have this data class at all, it's not blocked
        if (!matchingBindingKey) return false;

        const bindingValues = binding[matchingBindingKey];

        // For the inhibitor to block this binding, the binding must contain
        // ALL values specified in the inhibitor (subset check)
        return inhibitorValues.every((inhibitorValue) =>
          bindingValues.includes(inhibitorValue),
        );
      },
    );
  });
}

export function filterBindingsByInhibitors(
  bindings: BindingPerDataClass[],
  arcPlaceInfoDict: ArcPlaceInfoDict,
): BindingPerDataClass[] {
  const inhibitorArcs = getInhibitorArcs(arcPlaceInfoDict);

  // Early return: if no inhibitor arcs exist, return original bindings
  if (Object.keys(inhibitorArcs).length === 0) {
    return bindings;
  }

  // Get all incoming data classes (excluding inhibitor arcs)
  const incomingDataClassKeys = getAllIncomingDataClassKeys(arcPlaceInfoDict);

  const relevantInhibitorArcs = Object.fromEntries(
    Object.entries(inhibitorArcs).filter(([_, arcPlaceInfo]) =>
      hasRelevantDataClasses(arcPlaceInfo, incomingDataClassKeys),
    ),
  );

  // Early return: if no relevant inhibitor arcs, return original bindings
  if (Object.keys(relevantInhibitorArcs).length === 0) {
    return bindings;
  }

  // Step 1: Generate all inhibitor bindings (blocked combination)
  const inhibitorBindings = getInhibitorBindings(
    relevantInhibitorArcs,
    incomingDataClassKeys,
  );

  console.log("Inhibitor bindings (blocked combinations)", inhibitorBindings);

  // Step 2: Filter out bindings that are blocked
  const filteredBindings = bindings.filter(
    (binding) => !isBindingBlocked(binding, inhibitorBindings),
  );

  return filteredBindings;
}

// Example (updated to match expanded format):
// Input bindings (after expansion):
// [
//   {I:false: ['1'], O:false: ['1']}, {I:false: ['1'], O:false: ['2']}, {I:false: ['1'], O:false: ['3']},
//   {I:false: ['2'], O:false: ['1']}, {I:false: ['2'], O:false: ['2']}, {I:false: ['2'], O:false: ['3']},
//   {I:false: ['3'], O:false: ['1']}, {I:false: ['3'], O:false: ['2']}, {I:false: ['3'], O:false: ['3']}
// ]
//
// Inhibitor bindings: [{I:false: ['2'], O:false: ['3']}, {I:false: ['2'], O:false: ['2']}]
//
// Output after filtering:
// [
//   {I:false: ['1'], O:false: ['1']}, {I:false: ['1'], O:false: ['2']}, {I:false: ['1'], O:false: ['3']},
//   {I:false: ['2'], O:false: ['1']}, // Kept: I=2,O=1 not blocked
//   {I:false: ['3'], O:false: ['1']}, {I:false: ['3'], O:false: ['2']}, {I:false: ['3'], O:false: ['3']}
// ]
// Removed: {I:false: ['2'], O:false: ['2']} and {I:false: ['2'], O:false: ['3']}
