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
	  Object.entries(arcPlaceInfo.dataClassInfoDict).map(
		([dataClassId, dataClassInfo]) => ({
		  id: dataClassId,
		  alias: dataClassInfo.alias,
		  isVariable: dataClassInfo.isVariable,
		}),
	  ),
	  arcPlaceInfo.tokens,
	);

	validInputBindings = validInputBindings.filter((inputBinding) => {
	  // For each group, binding must include all or none of the token values for every data class in the group
	  for (const arcBinding of Object.values(groupedTokens)) {
		for (const dataClassKey of Object.keys(arcBinding)) {
		  const tokenValues = arcBinding[dataClassKey];
		  const bindingValues = inputBinding[dataClassKey] ?? [];
		  const hasAny = tokenValues.some((tokenValue) =>
			bindingValues.includes(tokenValue),
		  );
		  const hasAll = tokenValues.every((tokenValue) =>
			bindingValues.includes(tokenValue),
		  );
		  if (hasAny && !hasAll) {
			// Partially included, exclude binding
			return false;
		  }
		}
	  }
	  return true;
	});
  }
  return validInputBindings;
}
