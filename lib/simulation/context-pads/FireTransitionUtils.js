export function cartesianProduct(valuesList) {
  if (valuesList.length === 1) return valuesList;

  return [
    valuesList.reduce(
      (acc, list) => acc.flatMap((a) => list.map((b) => [...a, b[0]])),
      [[]],
    ),
  ];
}
/**
 * Find all tokens in a place whose values satisfy the binding constraints.
 *
 * A token matches if for every value in the token, there exists a corresponding allowed value for that color in the binding.
 *
 * @param {Object} place - The place object containing the marking.
 * @param {Array} arcElements - Inscription elements providing variableName ordering
 * @param {Object|Object[]} binding - Selected binding(s) mapping variable names to values.
 * @returns {Object[]|null} - Array of matching token business objects, or null if none found.
 */
export function findMatchingToken(place, arcElements, binding) {
  const marking = place?.businessObject?.marking || [];
  if (!marking.length) return null;

  const bindingArray = Array.isArray(binding) ? binding : [binding];

  // Build a map of allowed vales per color.id: Map<colorId, Set<value>>
  const allowedValuesByColor = new Map();

  arcElements.forEach((el, i) => {
    const variableName = el.variableName;
    const color = place?.businessObject?.color?.[i];
    if (!variableName || !color?.id) return;

    bindingArray.forEach((b) => {
      const value = b[variableName];
      if (value === undefined) return;

      const set = allowedValuesByColor.get(color.id) ?? new Set(); // getOrDefault
      set.add(value);

      allowedValuesByColor.set(color.id, set);
    });
  });

  // If no allowed values were found, return early
  if (!allowedValuesByColor.size) return null;

  // Filter tokens: a token matches if ALL its values are in the allowed sets
  const matches = marking.filter((token) => {
    const values = token?.values || [];
    if (!values.length) return false;

    return values.every((tv) => {
      const colorId = tv?.dataClass?.id;
      if (!colorId) return false;

      const allowedSet = allowedValuesByColor.get(colorId);
      return allowedSet ? allowedSet.has(tv.value) : false;
    });
  });

  return matches.length > 0 ? matches : null;
}

/**
 *  Collect values for generated variables on outgoing arcs.
 *  Reserves identifiers for generated variables.
 *
 * @param {Array} outgoingArcs - Transition outgoing arcs
 * @param {Object} identifierService - Service providing reserveIdentifier / generateUniqueId
 * @returns {{generatedBinding: Object, reservations: Array}} - Generated binding and reservations
 */
export function generateValuesForBinding(outgoingArcs, identifierService) {
  const generatedVariables = new Map(); // variableName -> color
  const reservations = [];
  const generatedBinding = {};

  for (const arc of outgoingArcs || []) {
    const elements = arc.businessObject.inscription?.inscriptionElements || [];
    const targetPlace = arc.target;

    elements.forEach((el, i) => {
      if (!el.isGenerated) return;
      if (!el.variableName) return;
      if (generatedVariables.has(el.variableName)) return; // keep first occurrence

      const color = targetPlace?.businessObject?.color?.[i];
      if (!color) return;

      generatedVariables.set(el.variableName, color);
    });
  }

  for (const [variableName, color] of generatedVariables.entries()) {
    try {
      const token = identifierService.reserveIdentifier(color);
      reservations.push(token);
      generatedBinding[variableName] = token.id;
    } catch (e) {
      generatedBinding[variableName] =
        identifierService.generateUniqueId(color);
    }
  }

  return { generatedBinding, reservations };
}

/**
 * Map binding values (including generated) to token value maps for a given data class
 *
 * @param {Object} place
 * @param {Array} inscriptionElements
 * @param {Object} dataClass
 * @param {Object|Object[]} bindings
 * @param {Object} generatedBinding
 * @returns {Object[]} - Array of token value maps [{ dataClassId: value }, ...]
 */
export function getTokenValueMapFromBinding(
  place,
  inscriptionElements,
  dataClass,
  bindings,
  generatedBinding,
) {
  const bindingArray = Array.isArray(bindings) ? bindings : [bindings];
  const mappedValues = [];

  inscriptionElements.forEach((el) => {
    if (el.dataClass != dataClass) return;

    const variableName = el.variableName;
    if (!variableName) return;

    let values;
    if (el.isGenerated) {
      const value = generatedBinding[variableName];
      values = value !== undefined ? [value] : [];
    } else {
      values = bindingArray
        .map((b) => b?.[variableName])
        .filter((v) => v !== undefined && v !== null);
    }

    if (!values.length) {
      console.warn(
        `Value for label "${variableName}" not found in binding for place ${place.id}.`,
      );
      return;
    }

    values.forEach((value) => mappedValues.push({ [dataClass.id]: value }));
  });
  return mappedValues;
}
