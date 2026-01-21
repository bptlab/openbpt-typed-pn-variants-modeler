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

  function getDataClassKeysFromArcs(arcs: Arc[], isOutgoing: boolean): Set<string> {
    const dataClassKeys = new Set<string>();
    for (const arc of arcs) {
      const inscriptionElements =
        arc.businessObject.inscription?.inscriptionElements || [];
      const variableType = arc.businessObject.variableType || { id: "", alias: "" };
      if (inscriptionElements.length === 0) {
        return new Set(); // Return an empty Set to indicate no output data class keys
      }
      for (const el of inscriptionElements) {
        if (isOutgoing && el.isGenerated) continue;
        dataClassKeys.add(getDataClassKey(
          el.dataClass.id,
          el.dataClass.alias,
          (el.dataClass.id === variableType.id && el.dataClass.alias === variableType.alias),
        ));
      }
    }
    return dataClassKeys;
  }

  const inputDataClassKeys = getDataClassKeysFromArcs(incomingArcs, false);
  const outputDataClassKeys = getDataClassKeysFromArcs(outgoingArcs, true);

  return [(outputDataClassKeys.size === 0 && outgoingArcs.length > 0) || 
    Array.from(outputDataClassKeys).some(key => !inputDataClassKeys.has(key)), Array.from(outputDataClassKeys).filter(key => !inputDataClassKeys.has(key))];
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
