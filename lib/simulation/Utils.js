export function getValidBindings(transition) {
  const arcBindings = [];

  for (const arc of transition.incoming) {
    const { inscription, source: sourcePlace } = arc.businessObject;
    if (
      !inscription ||
      !inscription.inscriptionElements ||
      !inscription.inscriptionElements.length
    ) {
      return [];
    }

    if (!sourcePlace?.marking?.length) {
      return [];
    }

    const variables = inscription.inscriptionElements.map(
      ({ variableName, dataClass }) => ({
        label: variableName,
        dataClassId: dataClass.id,
      })
    );

    const arcBindingCandidates = [];

    for (const token of sourcePlace.marking) {
      const tokenMap = Object.fromEntries(
        token.values.map(({ dataClass, value }) => [dataClass?.id, value])
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

    arcBindings.push(arcBindingCandidates);
  }

  const combinedBindings = cartesianProduct(arcBindings)
    .filter((bindingSet) => {
      const merged = {};
      for (const binding of bindingSet) {
        for (const [k, v] of Object.entries(binding)) {
          if (merged[k] !== undefined && merged[k] !== v) return false;
          merged[k] = v;
        }
      }
      return true;
    })
    .map((bindingSet) =>
      // merge each valid bindingSet into one binding
      bindingSet.reduce((acc, binding) => ({ ...acc, ...binding }), {})
    );
  return combinedBindings;
}

export function canTrigger(transition) {
  return getValidBindings(transition).length > 0;
}

export function getChildById(element, id) {
  return element.children.find((child) => child.id === id);
}

function cartesianProduct(arrays) {
  return arrays.reduce(
    (a, b) => a.flatMap((d) => b.map((e) => [].concat(d, e))),
    [[]]
  );
}
