/**
 * Determines whether there are any unbound output variables in the outgoing arcs.
 *
 * This function checks if any variable in the outgoing arcs' inscriptions is not present
 * in the set of input variable names collected from the incoming arcs (excluding inhibitor arcs).
 * A variable is considered "unbound" if it is not generated (`!el.isGenerated`) and does not
 * exist in the set of input variable names.
 *
 * @param incomingArcs - The array of incoming arcs to the node, used to collect input variable names.
 * @param outgoingArcs - The array of outgoing arcs from the node, whose output variables are checked.
 * @returns `true` if there is at least one unbound output variable in the outgoing arcs; otherwise, `false`.
 */
export function hasUnboundOutputVariables(
  incomingArcs: Arc[],
  outgoingArcs: Arc[],
): boolean {
  const inputVariableNames = new Set<string>();
  for (const arc of incomingArcs) {
    if (arc.businessObject.isInhibitorArc) continue; // exclude inhibitor arcs
    const inscriptionElements =
      arc.businessObject.inscription?.inscriptionElements || [];
    for (const el of inscriptionElements) {
      inputVariableNames.add(
        el.variableName +
          (arc.businessObject.variableType?.id === el.dataClass.id && 
            arc.businessObject.variableType?.alias === el.dataClass.alias ? "[]" : ""),
      );
    }
  }

  for (const arc of incomingArcs) {
    console.log("Incoming arc:", arc.id, arc.businessObject.inscription, arc.businessObject.variableType);
  }
  console.log("Input variable names:", Array.from(inputVariableNames));

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

/**
 * Determines whether there is a mismatch between the variable types
 * of the incoming and outgoing arcs.
 *
 * This function compares the dataclass names associated with the incoming and outgoing arcs.
 * If both arrays are non-empty and there is a mismatch in their variable types,
 * the function returns `true`. Otherwise, it returns `false`.
 *
 * @param incomingArcs - The array of incoming `Arc` objects to check.
 * @param outgoingArcs - The array of outgoing `Arc` objects to check.
 * @returns `true` if there is a mismatch in variable types between incoming and outgoing arcs, otherwise `false`.
 */
export function hasMismatchedVariableTypes(
  incomingArcs: Arc[],
  outgoingArcs: Arc[],
): boolean {
  if (incomingArcs.length > 0 && outgoingArcs.length > 0) {
      const incomingDataclassNameDict = buildDataclassNameDictionary(incomingArcs);
      const outgoingDataclassNameDict = buildDataclassNameDictionary(outgoingArcs);
      // check that variable incoming and outgoing arcs match
      console.log("Incoming dataclass name dict:", incomingDataclassNameDict);
        console.log("Outgoing dataclass name dict:", outgoingDataclassNameDict);
      if (isMismatch(incomingDataclassNameDict, outgoingDataclassNameDict)) {
        return true;
      }  
    }
    
  return false;
}

/**
 * Builds a dictionary mapping each data class ID to a set of variable names found in the provided arcs.
 *
 * Iterates over the given array of `Arc` objects, extracting the `dataClassId` from each arc's business object.
 * For each arc, it looks for inscription elements that match the `dataClassId` and collects their variable names.
 * The result is an object where each key is a `dataClassId` and the value is a `Set` of variable names associated with that data class.
 * If an arc is missing the necessary information (`dataClassId` or `inscriptionElements`), it is skipped.
 *
 * @param arcs - An array of `Arc` objects to process.
 * @returns An object mapping each `dataClassId` to a `Set` of variable names found in the arcs.
 */
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

/**
 * Determines whether two dictionaries of string sets are mismatched.
 *
 * A mismatch is defined as:
 * - The dictionaries have different sets of keys, or
 * - For any key, the corresponding sets have different sizes, or
 * - For any key, the corresponding sets contain different elements.
 *
 * @param dict1 - The first dictionary mapping strings to sets of strings.
 * @param dict2 - The second dictionary mapping strings to sets of strings.
 * @returns `true` if the dictionaries are mismatched; otherwise, `false`.
 */
function isMismatch(incoming: { [key: string]: Set<string> }, outgoing: { [key: string]: Set<string> }) {
const outgoingKeys = Object.keys(outgoing);
  // Only check that all keys/values from outgoing are in incoming
  for (const key of outgoingKeys) {
    if (!(key in incoming)) return true;
    const incomingVals = incoming[key];
    const outgoingVals = outgoing[key];
    for (const val of outgoingVals) {
      if (!incomingVals.has(val)) return true;
    }
  }
return false;
}

/**
 * Determines whether all arcs in the provided dictionary have available tokens.
 *
 * For each entry in the `arcPlaceInfoDict`, this function checks if either:
 * - The arc is an inhibitor arc (`isInhibitorArc` is `true`), or
 * - The arc has at least one token (`tokens.length > 0`).
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc identifiers to their corresponding place information.
 * @returns `true` if every arc is either an inhibitor arc or has at least one token; otherwise, `false`.
 */
export function hasAvailableTokensForAllArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): boolean {
  return Object.values(arcPlaceInfoDict).every(
    (arcPlaceInfo) =>
      arcPlaceInfo.isInhibitorArc || arcPlaceInfo.tokens.length > 0,
  );
}