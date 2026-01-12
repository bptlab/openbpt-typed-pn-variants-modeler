import {
  getAllDataClassKeysFromArcs,
  getBaseDataClassKey,
  getDataClassKey,
} from "./bindingUtilsHelper";
import { cartesianProductBindings } from "./bindingUtilsLinkingLogic";

/**
 * Filters and returns only the non-inhibitor arcs from the provided arc-place information dictionary.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc-place identifiers to their corresponding information, including tokens and inhibitor status.
 * @returns A new dictionary containing only the entries where `isInhibitorArc` is `false`.
 */
export function getNonInhibitorArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): ArcPlaceInfoDict {
  return Object.fromEntries(
    Object.entries(arcPlaceInfoDict).filter(
      ([_, arcPlaceInfo]) => !arcPlaceInfo.isInhibitorArc,
    ),
  );
}

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
 * Checks if an inhibitor arc ...
 * 1. has tokens
 * 2. is not linking
 * 3. only has data classes that exist in the incoming arcs
 *
 * @param arcPlaceInfo - The arc-place information to check.
 * @param incomingDataClassKeys - Set of all data class keys from incoming arcs (excluding inhibitor arcs).
 * @returns `true` if all data classes from the arc exist in incoming arcs; otherwise, `false`.
 */
function isRelevant(
  arcPlaceInfo: ArcPlaceInfo,
  incomingDataClassKeys: Set<string>,
): boolean {
  if (Object.keys(arcPlaceInfo.dataClassInfoDict).length === 0) {
    return false;
  }

  if (arcPlaceInfo.isLinkingPlace) {
    console.warn("Inhibitor arcs with more than one data class are not supported.");
    return false;
  }

  const incomingBaseDataClassKeys = new Set(
    Array.from(incomingDataClassKeys).map(getBaseDataClassKey),
  );

  return Object.entries(arcPlaceInfo.dataClassInfoDict).every(
    ([dataClassId, dataClassInfo]) => {
      const baseKey = getBaseDataClassKey(
        getDataClassKey(
          dataClassId,
          dataClassInfo.alias,
          dataClassInfo.isVariable,
        ),
      );
      return incomingBaseDataClassKeys.has(baseKey);
    },
  );
}

/**
 * Returns a set of relevant data class keys based on the provided inhibitor arcs and incoming data class keys.
 *
 * Iterates through each arc in the `relevantInhibitorArcs` dictionary, extracting data class information.
 * For each data class, constructs a base key using `getDataClassKey` and `getBaseDataClassKey`.
 * Checks if the incoming data class keys contain either the `baseKey:true` or `baseKey:false` variant,
 * and adds the matching keys to the result set.
 *
 * @param relevantInhibitorArcs - A dictionary mapping arc identifiers to their corresponding place information, including data class info.
 * @param incomingDataClassKeys - A set of data class keys (as strings) to check for relevance.
 * @returns A set of relevant data class keys (as strings) that match the incoming keys with either `:true` or `:false` suffix.
 */
function getRelevantDataClassKeys(
  relevantInhibitorArcs: ArcPlaceInfoDict,
  incomingDataClassKeys: Set<string>,
): Set<string> {
  const relevantDataClassKeys = new Set<string>();

  for (const arcPlaceInfo of Object.values(relevantInhibitorArcs)) {
    for (const [dataClassId, dataClassInfo] of Object.entries(arcPlaceInfo.dataClassInfoDict)) {
      const baseKey = getBaseDataClassKey(
        getDataClassKey(
          dataClassId,
          dataClassInfo.alias,
          dataClassInfo.isVariable,
        )
      );

      // if (incomingDataClassKeys.has(baseKey + ":true")) {
      //   relevantDataClassKeys.add(baseKey + ":true");
      // }
      if (incomingDataClassKeys.has(baseKey + ":false")) {
        relevantDataClassKeys.add(baseKey + ":false");
      }
    }
  }

  return relevantDataClassKeys;
}

/**
 * Expands the given array of bindings by generating all possible combinations
 * of values for non-variable relevant data class keys. For each binding, if any
 * relevant non-variable data class key (identified by the suffix ":false") contains
 * multiple values, this function produces a new binding for each possible combination
 * of those values, ensuring that each such key in the resulting bindings contains
 * only a single value.
 *
 * @param bindings - The array of bindings to expand. Each binding is an object
 *   mapping data class keys to arrays of string values.
 * @param relevantDataClassKeys - A set of data class keys considered relevant for
 *   expansion. Only keys present in this set and ending with ":false" are expanded.
 * @returns An array of expanded bindings, where each binding represents a unique
 *   combination of single values for the relevant non-variable data class keys.
 */
function expandBindings(
  bindings: BindingPerDataClass[],
  relevantDataClassKeys: Set<string>,
): BindingPerDataClass[] {
  const expandedBindings: BindingPerDataClass[] = [];

  // For each binding, expand non-variable relevant data classes to single-value combinations
  for (const binding of bindings) {
    // Separate variable and non-variable relevant data classes
    const relevantKeys = Array.from(relevantDataClassKeys).filter(
      (key) => binding[key] && binding[key].length > 1
    );

    if (relevantKeys.length === 0) {
      expandedBindings.push(binding);
      continue;
    }

    // Prepare arrays for cartesian product
    const valueArrays: string[][] = relevantKeys.map((key) => binding[key]);

    // Helper: cartesian product for arrays of arrays
    function cartesianProduct<T>(arrays: T[][]): T[][] {
      if (arrays.length === 0) return [[]];
      return arrays.reduce<T[][]>(
        (acc, curr) =>
          acc.flatMap((a) => curr.map((b) => [...a, b])),
        [[]]
      );
    }

    // Get all combinations for non-variable relevant data classes
    const combos = cartesianProduct(valueArrays);

    for (const combo of combos) {
      // Create a new binding with single-value arrays for non-variable keys
      const newBinding: BindingPerDataClass = { ...binding };
      relevantKeys.forEach((key, idx) => {
        newBinding[key] = [combo[idx]];
      });
      expandedBindings.push(newBinding);
    }
  }

  return expandedBindings;
}

/**
 * Generates an array of `BindingPerDataClass` objects representing inhibitor tokens
 * from the provided inhibitor arcs information.
 *
 * For each token in each arc, creates a binding object where each key is the base data class key
 * (obtained via `getBaseDataClassKey`) suffixed with `:true` and `:false`, both mapped to the token's value in an array.
 * Each binding is then added to the result array.
 *
 * @param relevantInhibitorArcs - A dictionary mapping arc identifiers to their corresponding place information,
 *                                which includes tokens to be processed as inhibitor tokens.
 * @returns An array of `BindingPerDataClass` objects, each representing the inhibitor token bindings
 *          for the given arcs.
 */
function getInhibitorTokens(
  relevantInhibitorArcs: ArcPlaceInfoDict,
): BindingPerDataClass[] {
  const inhibitorTokens: BindingPerDataClass[] = [];

  for (const arcPlaceInfo of Object.values(relevantInhibitorArcs)) {
    for (const token of arcPlaceInfo.tokens) {
      const binding: BindingPerDataClass = {};
      for (const [dataClassKey, value] of Object.entries(token)) {
        binding[getBaseDataClassKey(dataClassKey)] = [value];
      }
      inhibitorTokens.push(binding);
    }
  }

  return inhibitorTokens;
}

/**
 * Filters an array of binding objects by removing values that are present in any of the inhibitor token objects.
 * For each binding, values in each property that are also found in the corresponding property of any inhibitor token are removed.
 * If any property of a binding becomes an empty array after filtering, that binding is excluded from the result.
 *
 * @param bindings - An array of binding objects, where each object maps string keys to arrays of values.
 * @param inhibitorTokens - An array of inhibitor token objects, each with the same structure as a binding, specifying values to be removed from the bindings.
 * @returns An array of filtered binding objects, each with values removed according to the inhibitor tokens, excluding any bindings with empty value arrays.
 */
function getFilteredBindings(
  bindings: BindingPerDataClass[],
  inhibitorTokens: BindingPerDataClass[],
): BindingPerDataClass[] {
  const filteredBindings: BindingPerDataClass[] = [];

  for (const binding of bindings) {
    let newBinding: BindingPerDataClass = { ...binding }
    let hasEmpty = false;
    for (const inhibitorToken of inhibitorTokens) {
      // All values of inhibitor token have to be in the binding in order to filter
      let allMatch = true;
      for (const key of Object.keys(inhibitorToken)) {
        const bindingValues = (newBinding[key + ":false"] || []).concat(newBinding[key + ":true"] || []);
        if (!inhibitorToken[key].every((v) => bindingValues.includes(v))) {
          allMatch = false;
          break;
        }
      }
      if (!allMatch) {
        continue;
      }

      newBinding = { ...newBinding };
      for (const key of Object.keys(binding)) {
        if (newBinding[key].length === 0 || !(inhibitorToken[getBaseDataClassKey(key)])) {
          continue;
        }

        console.log("blupp")

        newBinding[key] = newBinding[key].filter(
          (v) => !inhibitorToken[getBaseDataClassKey(key)].includes(v)
        );

        if (newBinding[key].length === 0) {
          hasEmpty = true;
          break;
        }
      }
    }
    if (!hasEmpty) {
      filteredBindings.push(newBinding);
    }
  }

  // Remove bindings that are subsets of other bindings
  return filteredBindings

  // For usage with power set, run the subset filter
  // return filteredBindings.filter((candidate, idx, arr) => {
  //   return !arr.some((other, j) => {
  //     if (j === idx) return false;
  //     // candidate is a subset of other if for every key, candidate[key] ⊆ other[key]
  //     return Object.keys(candidate).every((key) => {
  //       const candVals = candidate[key] || [];
  //       const otherVals = other[key] || [];
  //       // candidate must be strictly smaller in at least one key to be a subset
  //       return candVals.every((v) => otherVals.includes(v));
  //     }) && Object.keys(candidate).some((key) => {
  //       const candVals = candidate[key] || [];
  //       const otherVals = other[key] || [];
  //       return otherVals.length > candVals.length;
  //     });
  //   });
  // });
}


/**
 * Filters a list of bindings by removing those that are inhibited according to the inhibitor arcs
 * defined in the provided arc-place information dictionary.
 *
 * This function:
 * - Identifies relevant inhibitor arcs based on the current arc-place information and incoming data classes.
 * - Expands the bindings so that all non-variable relevant data classes have single-value arrays.
 * - Retrieves inhibitor tokens from the relevant inhibitor arcs.
 * - Filters out bindings that contain token values present in the inhibitor tokens.
 * - Returns the filtered list of bindings, or the original bindings if no relevant inhibitor arcs exist.
 *
 * @param bindings - The array of `BindingPerDataClass` objects to be filtered.
 * @param arcPlaceInfoDict - The dictionary containing arc-place information, including inhibitor arcs.
 * @returns The filtered array of `BindingPerDataClass` objects, excluding those inhibited by relevant inhibitor arcs.
 */
export function filterBindingsByInhibitors(
  bindings: BindingPerDataClass[],
  arcPlaceInfoDict: ArcPlaceInfoDict,
): BindingPerDataClass[] {
  const inhibitorArcs = getInhibitorArcs(arcPlaceInfoDict);

  // Get all incoming data classes (excluding inhibitor arcs)
  const incomingDataClassKeys = getAllDataClassKeysFromArcs(
    getNonInhibitorArcs(arcPlaceInfoDict)
  );

  // ----------------------------------------------------------
  // ** For now we only consider non linking inhibitor arcs! **
  // ----------------------------------------------------------

  // Filter inhibitor arcs to only those relevant 
  // (having tokens and data classes in incoming arcs)
  const relevantInhibitorArcs = Object.fromEntries(
    Object.entries(inhibitorArcs).filter(([_, arcPlaceInfo]) =>
      isRelevant(arcPlaceInfo, incomingDataClassKeys),
    ),
  );

  // Early return: if no relevant inhibitor arcs exist, return original bindings
  if (Object.keys(relevantInhibitorArcs).length === 0) {
    return bindings;
  }


  // TODO: Check if necessary. If we really dont want to deal with link inhibitor arcs, this is not necessary
  // const relevantDataClassKeys = getRelevantDataClassKeys(
  //   relevantInhibitorArcs,
  //   incomingDataClassKeys,
  // );

  console.log("Bindings before expansion", bindings);

  // TODO: Check if necessary. If we really dont want to deal with link inhibitor arcs, this is not necessary
  // Expand Bindings so that all non variable relevant data classes have single-value arrays
  // bindings = expandBindings(bindings, relevantDataClassKeys);
  // bindings = powerSet(bindings, relevantDataClassKeys);

  console.log("Expanded bindings", bindings);

  // Get inhibitor tokens as bindings
  const inhibitorTokens = getInhibitorTokens(relevantInhibitorArcs);

  console.log("Inhibitor tokens", inhibitorTokens);

  // Filter out tokenvalues that are part of inhibitor tokens
  // If any array becomes empty, the binding is removed
  const filteredBindings = getFilteredBindings(bindings, inhibitorTokens);

  // TODO: collect all values for variable data classes in one binding again 

  return filteredBindings;
}


export function powerSet(
  bindings: BindingPerDataClass[],
  relevantDataClassKeys: Set<string>,
): BindingPerDataClass[] {
  const expanded: BindingPerDataClass[] = [];

  for (const binding of bindings) {
    expanded.push(...expandBinding(binding, relevantDataClassKeys));
  }

  return expanded;
}

export function expandBinding(
  binding: BindingPerDataClass,
  relevantDataClassKeys: Set<string>,
): BindingPerDataClass[] {
  const dataClassKeys = Object.keys(binding);

  if (dataClassKeys.length === 0) {
    return [{}];
  }

  const valueArrays: BindingPerDataClass[][] = [];

  for (const key of dataClassKeys) {
    if (!relevantDataClassKeys.has(key)) {
      valueArrays.push([{ [key]: binding[key] }]);
      continue;
    }
    const values = binding[key];
    const isVariable = key.endsWith(":true");

    if (isVariable) {
      // For variable arcs: generate all non-empty subsets
      const subsets = getPowerSet(values).filter((subset) => subset.length > 0);
      valueArrays.push(subsets.map((subset) => ({ [key]: subset })));
    } else {
      // For non-variable arcs: one value per binding
      valueArrays.push(values.map((value) => ({ [key]: [value] })));
    }
  }

  return cartesianProductBindings(valueArrays);
}

function getPowerSet<T>(array: T[]): T[][] {
  const result: T[][] = [[]];

  for (const item of array) {
    const length = result.length;
    for (let i = 0; i < length; i++) {
      result.push([...result[i], item]);
    }
  }

  return result;
}
