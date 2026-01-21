import { getDataClassKey } from "./bindingUtilsHelper";

/**
 * Determines whether there are any output variables in the outgoing arcs that are not bound by the input variables
 * from the incoming arcs. An output variable is considered "unbound" if its data class key does not exist among
 * the input data class keys.
 *
 * The function ignores inhibitor arcs and skips generated inscription elements when collecting output data class keys.
 *
 * @param incomingArcs - Array of incoming Arc objects to check for input variable bindings. Inhibitor arcs are ignored.
 * @param outgoingArcs - Array of outgoing Arc objects to check for output variables. Generated inscription elements are ignored.
 * @returns `true` if there is at least one output variable that is not bound by any input variable; otherwise, `false`.
 */
export function hasUnboundOutputVariables(
  incomingArcs: Arc[],
  outgoingArcs: Arc[],
): [boolean, string[]] {
  incomingArcs = incomingArcs.filter((arc) => !arc.businessObject.isInhibitorArc);
  outgoingArcs = outgoingArcs.filter((arc) => !arc.businessObject.isInhibitorArc);

  function getDataClassKeysFromArcs(arcs: Arc[], isOutgoing: boolean): [Set<string>, number] {
    const dataClassKeys = new Set<string>();
    let completelyGeneratedArcs = 0;
    for (const arc of arcs) {
      const inscriptionElements =
        arc.businessObject.inscription?.inscriptionElements || [];
      const variableType = arc.businessObject.variableType || { id: "", alias: "" };
      if (inscriptionElements.length === 0) {
        return [new Set(), 0]; // Return an empty Set and zero count to indicate no data class keys
      }
      let countGenerated = 0;
      for (const el of inscriptionElements) {
        if (isOutgoing && el.isGenerated) {
          countGenerated++;
          continue;
        }
        dataClassKeys.add(getDataClassKey(
          el.dataClass.id,
          el.dataClass.alias,
          (el.dataClass.id === variableType.id && el.dataClass.alias === variableType.alias),
        ));
      }
      if (isOutgoing && countGenerated === inscriptionElements.length)
        completelyGeneratedArcs++;
    }
    return [dataClassKeys, completelyGeneratedArcs];
  }

  const inputDataClassKeys = getDataClassKeysFromArcs(incomingArcs, false)[0];
  const [outputDataClassKeys, completelyGeneratedArcs] = getDataClassKeysFromArcs(outgoingArcs, true);

  const outputDataClassKeysArray = 
    (inputDataClassKeys.size === 0 && incomingArcs.length > 0) 
    ? [] 
    : Array.from(outputDataClassKeys).filter(key => !inputDataClassKeys.has(key));

  return [(outputDataClassKeys.size === 0 && outgoingArcs.length - completelyGeneratedArcs > 0) || 
    Array.from(outputDataClassKeys).some(key => !inputDataClassKeys.has(key)), 
    outputDataClassKeysArray];
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
