function cartesianProduct(arrays) {
  if (arrays.length === 0) return [[]];

  return arrays.reduce(
    (acc, current) =>
      acc.flatMap((product) =>
        current
          .map((item) => [...product, [item]])
          .filter((combined) => {
            // Check if all items can be merged (overlapping keys have same values)
            const merged = Object.assign({}, ...combined.flat());
            return combined.flat().every((obj) =>
              Object.keys(obj).every((key) => merged[key] === obj[key])
            );
          })
      ),
    [[]],
  );
}

// Build valid input bindings for a transition (only real input arcs considered here).
// This function returns an array of binding objects mapping variableName -> array[value].
// These mapped arrays contain all values for one variableName that can be used to fire once.
export function getValidInputBindingsBasic(transition) {
  
  // in applyInhibitorArcs we should gather all Tokens on inhibitors for current transition
  // and delete them from the binding. If thereby a non empty list is emptied, we have to filter out this binding
  function getInhibitorTokenListForArc(variables) {
    const outgoingArcs = transition.outgoing || [];
    const incomingArcs = transition.incoming || [];
    const inhibitorTokenList = [];
    
    if (variables.length === 0) return inhibitorTokenList;
    
    for (const inhibitorArc of [...incomingArcs, ...outgoingArcs]) {
      if (!inhibitorArc.businessObject.isInhibitorArc) continue;
      
      const inhibitorElements = inhibitorArc.businessObject?.inscription?.inscriptionElements.map(
        ({ variableName, dataClass }) => ({
          label: variableName,
          dataClassId: dataClass.id,
        }),
      );

      const interestingInhibitorElements = inhibitorElements.filter(elem =>
        variables.some(variable =>
          variable.label === elem.label &&
          variable.dataClassId === elem.dataClassId
        )
      );
      if (interestingInhibitorElements.length === 0) continue;

      const elements =
        inhibitorArc.businessObject.inscription?.inscriptionElements || [];
      if (elements.length === 0) continue;

      const place = incomingArcs.includes(inhibitorArc)
        ? inhibitorArc.source || null
        : inhibitorArc.target || null;
      if (!place || !place.businessObject) continue;

      const marking = place.businessObject.marking || [];
      for (const token of marking) {
        // TODO: make this work for token with multiple values (i.e. O x I)    
        inhibitorTokenList.push({
          dataClassId: token.values[0].dataClass.id,
          value: token.values[0].value
        })
      }
    }
    return inhibitorTokenList;
  }

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

    const inhibitorTokenList = getInhibitorTokenListForArc(variables);

    const arcBindingCandidates = [];

    for (const token of sourcePlace.marking) {

      const tokenValues = (token.values || []).map(({ dataClass, value }) => ({
        dataClassId: dataClass?.id,
        value: value,
      }));

      if (tokenValues.some(token => inhibitorTokenList.some(inhibitorToken =>
          inhibitorToken.value === token.value &&
          inhibitorToken.dataClassId === token.dataClassId
        ))
      ) {
        continue;}

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


  let combinedSingleArcBindings = new Set(cartesianProduct(singleArcBindings));
  combinedSingleArcBindings = [...combinedSingleArcBindings]

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

  function isInvalidDueToOutputs() {
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
    _ => !isInvalidDueToOutputs(),
  );
}

export function transitionIsEnabled(transition) {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}
