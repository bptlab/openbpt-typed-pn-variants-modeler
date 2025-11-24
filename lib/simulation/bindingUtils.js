export function cartesianProduct(arrays) {
  if (arrays.length === 0) return [[]];

  return arrays.reduce(
    (acc, current) =>
      acc.flatMap((product) => current.map((item) => [...product, [item]])),
    [[]],
  );
}

// Build valid input bindings for a transition (only real input arcs considered here).
// This function returns an array of binding objects mapping variableName -> array[value].
// These mapped arrays contain all values for one variableName that can be used to fire once.
export function getValidInputBindingsBasic(transition) {
  const arcBindings = [];

  for (const arc of transition.incoming) {
    // ignore inhibitor arcs for building input binding candidates
    if (arc.businessObject.isInhibitorArc) continue;

    const { inscription, source: sourcePlace } = arc.businessObject;
    if (
      !inscription ||
      !inscription.inscriptionElements ||
      !inscription.inscriptionElements.length
    ) {
      return [];
    }

    if (!sourcePlace?.marking?.length) {
      // a real input arc with an empty place prevents firing
      return [];
    }

    const variables = inscription.inscriptionElements.map(
      ({ variableName, dataClass }) => ({
        label: variableName,
        dataClassId: dataClass.id,
      }),
    );

    const arcBindingCandidates = [];

    for (const token of sourcePlace.marking) {
      const tokenMap = Object.fromEntries(
        (token.values || []).map(({ dataClass, value }) => [
          dataClass?.id,
          value,
        ]),
      );

      const binding = {};
      let isValid = true;

      for (const { label, dataClassId } of variables) {
        if (tokenMap[dataClassId] === undefined) {
          isValid = false;
          break;
        }
        binding[label] = tokenMap[dataClassId];
      }

      if (isValid) arcBindingCandidates.push(binding);
    }

    if (!arcBindingCandidates.length) return [];

    const type = arc.businessObject.variableType ? "variable" : "non-variable";

    arcBindings.push({ binding: arcBindingCandidates, arcType: type });
  }

  const singleArcBindings = arcBindings
    .filter((arcBindings) => arcBindings.arcType === "non-variable")
    .map((ab) => ab.binding);
  const variableArcBindings = arcBindings
    .filter((arcBindings) => arcBindings.arcType === "variable")
    .map((ab) => ab.binding);

  const combinedSingleArcBindings = cartesianProduct(singleArcBindings);

  const combinedBindings = combinedSingleArcBindings;
  for (const singleArcBinding of combinedBindings) {
    for (const variableArcBinding of variableArcBindings) {
      singleArcBinding.push(variableArcBinding);
    }
  }

  return combinedBindings;
}

// Full function used by simulation: applies inhibitor arc negative checks and output-read rule.
// Returns a list containing each valid binding. A binding itself is represented as a list of lists for each valueType.
// These lists per valueType contain exactly one item, if the arc is non-variable and all possible, if it is variable.
export function getValidInputBindings(transition) {
  const combinedBindings = getValidInputBindingsBasic(transition);

  // collect outgoing/incoming arcs
  const outgoingArcs = transition.outgoing || [];
  const incomingArcs = transition.incoming || [];

  const generatedVarNames = new Set();
  outgoingArcs.forEach((arc) => {
    if (arc.businessObject.isInhibitorArc) return;
    const elements = arc.businessObject.inscription?.inscriptionElements || [];
    elements.forEach((el) => {
      if (el && el.isGenerated) generatedVarNames.add(el.variableName);
    });
  });

  const realInputVarNames = new Set();
  incomingArcs.forEach((arc) => {
    if (arc.businessObject.isInhibitorArc) return;
    const labels = (
      arc.businessObject?.inscription?.inscriptionElements || []
    ).map((el) => el.variableName);
    labels.forEach((l) => realInputVarNames.add(l));
  });

  function isBlockedByInhibitor(binding) {
    for (const arc of [...incomingArcs, ...outgoingArcs]) {
      if (!arc.businessObject.isInhibitorArc) continue;

      const elements =
        arc.businessObject.inscription?.inscriptionElements || [];
      if (elements.length === 0) continue;

      const place = incomingArcs.includes(arc)
        ? arc.source || null
        : arc.target || null;
      if (!place || !place.businessObject) continue;

      const expected = {};
      elements.forEach((el, idx) => {
        const label = el.variableName;
        const dataClass = place.businessObject.color?.[idx];
        if (!dataClass) return;
        const value = binding[label];
        if (value === undefined) return;
        expected[dataClass.id] = value;
      });

      if (Object.keys(expected).length === 0) continue;

      const marking = place.businessObject.marking || [];
      for (const token of marking) {
        const tokenMap = {};
        (token.values || []).forEach((v) => {
          if (v && v.dataClass && v.dataClass.id)
            tokenMap[v.dataClass.id] = v.value;
        });
        const allMatch = Object.keys(expected).every(
          (k) => String(tokenMap[k]) === String(expected[k]),
        );
        if (allMatch) return true;
      }
    }
    return false;
  }

  function isInvalidDueToOutputs(binding) {
    for (const arc of outgoingArcs) {
      if (arc.businessObject.isInhibitorArc) continue;

      const elements =
        arc.businessObject.inscription?.inscriptionElements || [];
      const hasUnboundVariable = elements.some(
        (el) => !el.isGenerated && !realInputVarNames.has(el.variableName),
      ); // unbound = variable not generated and not as input

      if (hasUnboundVariable) return true;
    }

    return false;
  }

  return combinedBindings.filter(
    (b) => !isBlockedByInhibitor(b) && !isInvalidDueToOutputs(b),
  );
  // filter inhibitors in a way, that we get all tokens on inhibitor arcs and return the bindings - those tokens
  // isinvalidduetooutputs has now also to check that if i.e. o[] is input then o as output is illegal
}

export function transitionIsEnabled(transition) {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}
