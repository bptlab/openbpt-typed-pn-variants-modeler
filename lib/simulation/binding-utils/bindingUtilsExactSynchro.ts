import { groupTokensByNonVariableDataclasses } from "./bindingUtilsLinkingLogic";


/**
 * Filters the provided input bindings to enforce "exact synchronization" constraints
 * on arcs marked as exact syncing. For each such arc, the function groups tokens by
 * non-variable data classes and ensures that each binding either includes all token
 * values of any grouped token or none at all. Bindings that partially include token
 * values from a group are excluded.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc IDs to their corresponding place information,
 *   including data class info and tokens.
 * @param validInputBindings - An array of input bindings, each representing a mapping of data class IDs
 *   to their bound values, to be filtered according to the exact synchronization constraints.
 * @returns The filtered array of input bindings that satisfy the exact synchronization constraints
 *   for all arcs marked as exact syncing.
 */
export function checkExactSynchroConstraints(
  arcPlaceInfoDict: ArcPlaceInfoDict,
  validInputBindings: BindingPerDataClass[],
): BindingPerDataClass[] {
  const exactSynchroArcPlaceInfos = Object.values(arcPlaceInfoDict).filter(
    (arcPlaceInfo) => arcPlaceInfo.isExactSyncing,
  );

  for (const arcPlaceInfo of exactSynchroArcPlaceInfos) {
    const groupedTokens = groupTokensByNonVariableDataclasses(
      Object.entries(arcPlaceInfo.dataClassInfoDict).map(([dataClassId, dataClassInfo]) => 
				({id: dataClassId, alias: dataClassInfo.alias, isVariable: dataClassInfo.isVariable})),
      arcPlaceInfo.tokens,
    );
		// Filter validInputBindings: each binding must have all or none token values of any groupedToken
		validInputBindings = validInputBindings.filter(inputBinding => {
			let partiallyIncluded = false;
			let fullyIncludedDatasClasses = 0;
			for (const arcBinding of Object.values(groupedTokens)) {
				for (const dataClassKey of Object.keys(arcBinding)) {
					if (arcBinding[dataClassKey].some(tokenValue => inputBinding[dataClassKey].includes(tokenValue))) {partiallyIncluded = true}
					if (arcBinding[dataClassKey].every(tokenValue => inputBinding[dataClassKey].includes(tokenValue))) {fullyIncludedDatasClasses += 1}
				}
				if (partiallyIncluded && fullyIncludedDatasClasses < Object.keys(arcBinding).length) {
					return false; // Partially included, exclude binding
				}
				if (fullyIncludedDatasClasses === Object.keys(arcBinding).length) {
					return true; // Fully included, include binding
				}
			}
			return true; // No tokens from this arc, include binding
		});
  }
  return validInputBindings;
}