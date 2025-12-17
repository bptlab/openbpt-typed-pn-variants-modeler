// Binding: Maps variableName (e.g. O) to concrete value from token (e.g. Order_1)
type Binding = { [variableName: string]: string };

// ArcBindingCandidates: All possible bindings for one arc
type ArcBindingCandidates = Array<Binding>;

// ValidBindings: All valid complete bindings for a transition
// (chooses one binding from each ArcBindingsCandidates per arc)
type ValidBindings = Array<Binding>;

interface DataClassInfo {
  isVariable: boolean;
  label: string;
  tokenValues: Array<TokenValue["value"]>;
}

interface ArcPlaceInfo {
  arcId: string;
  placeId: string;
  token: Array<TokenValue>;
  isInhibitorArc: boolean;
  isLinkingPlace: boolean;
  // variableClass: DataClassInfo | undefined; // TODO: needed?
  dataClassInfoDict: {
    [dataClassId: string]: DataClassInfo;
  };
}

interface ArcPlaceInfoDict {
  [arcId: string]: ArcPlaceInfo;
}

function buildArcPlaceInfo(arc: Arc): ArcPlaceInfo {
  const place: Place = arc.businessObject.source as Place;
  const isInhibitorArc: boolean = arc.businessObject.isInhibitorArc || false;

  const dataClassInfoDict: {
    [dataClassId: string]: DataClassInfo;
  } = {};

  const marking = place.marking ?? [];

  for (const token of marking) {
    const tokenValues = token.values ?? [];
    for (const { dataClass, value } of tokenValues) {
      if (!dataClass) continue;

      if (!dataClassInfoDict[dataClass.id]) {
        dataClassInfoDict[dataClass.id] = {
          isVariable: false,
          label: "",
          tokenValues: [],
        };
      }

      if (!dataClassInfoDict[dataClass.id].tokenValues.includes(value)) {
        dataClassInfoDict[dataClass.id].tokenValues.push(value);
      }
    }
  }

  const inscriptionElements =
    arc.businessObject.inscription?.inscriptionElements ?? [];
  for (const element of inscriptionElements) {
    const dataClass = element.dataClass;
    const dataClassInfo = dataClassInfoDict[dataClass.id];
    if (dataClass?.id && dataClassInfo) {
      dataClassInfo.isVariable = arc.businessObject.variableType === dataClass;
      dataClassInfo.label = element.variableName;
    }
  }

  const customMarking: Array<TokenValue> = marking.flatMap((token) =>
    (token.values ?? [])
      .filter(({ dataClass }) => dataClass)
      .map(({ dataClass, value }) => ({ dataClass, value })),
  ); // Transforms marking of token into Array of TokenValues

  return {
    arcId: arc.id,
    placeId: place.id,
    token: customMarking,
    isInhibitorArc,
    isLinkingPlace: Object.keys(dataClassInfoDict).length > 1,
    dataClassInfoDict,
  };
}

// Returns true if any output arc has a non-generated variable that was not defined in the input arcs
function hasUnboundOutputVariables(
  incomingArcs: Array<Arc>,
  outgoingArcs: Array<Arc>,
): boolean {
  const inputVariableNames = new Set<string>(
    incomingArcs
      .filter((arc) => !arc.businessObject.isInhibitorArc) // exclude inhibitor arcs
      .flatMap(
        (arc: Arc) => arc.businessObject.inscription?.inscriptionElements || [],
      )
      .map((el: any) => el.variableName),
  );

  return outgoingArcs
    .filter((arc) => !arc.businessObject.isInhibitorArc)
    .some((arc) => {
      const inscriptionElements =
        arc.businessObject.inscription?.inscriptionElements || [];
      return inscriptionElements.some(
        (el: InscriptionElement) =>
          !el.isGenerated && !inputVariableNames.has(el.variableName),
      );
    });
}

function hasMismatchedVariableTypes(
  incomingArcs: Array<Arc>,
  outgoingArcs: Array<Arc>,
): boolean {
  // TODO: implement mismatched variables types check
  return false;
}

// Check if all non-inhibitor arcs have at least one available token
function hasAvailableTokensForAllArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): boolean {
  return Object.values(arcPlaceInfoDict).every(
    (arcPlaceInfo) =>
      arcPlaceInfo.isInhibitorArc || arcPlaceInfo.token.length > 0,
  );
}

function getInhibitorTokens(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Array<TokenValue> {
  const inhibitorTokens: Array<TokenValue> = [];

  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isInhibitorArc) continue;

    inhibitorTokens.push(...arcPlaceInfo.token);
  }

  return inhibitorTokens;
}

function cartesianProduct(arrays: Array<ArcBindingCandidates>): ValidBindings {
  if (arrays.length === 0) return [{}]; // empty binding;

  return arrays.reduce((acc, current) =>
    acc.flatMap((product) => current.map((item) => ({ ...product, ...item }))),
  );
}

function tokensEqual(tokenA: TokenValue, tokenB: TokenValue): boolean {
  return (
    tokenA.dataClass.id === tokenB.dataClass.id && tokenA.value === tokenB.value
  );
}

function isTokenBlockedByInhibitor(
  token: TokenValue,
  inhibitorTokens: Array<TokenValue>,
): boolean {
  return inhibitorTokens.some((inhibitorToken) =>
    tokensEqual(token, inhibitorToken),
  );
}

function buildBindingFromToken(
  token: TokenValue,
  dataClassInfoDict: { [dataClassId: string]: DataClassInfo },
): Binding {
  const binding: Binding = {};
  for (const [dataClassId, dataClassInfo] of Object.entries(
    dataClassInfoDict,
  )) {
    if (dataClassInfo.label && token.dataClass.id === dataClassId) {
      binding[dataClassInfo.label] = token.value;
    }
  }
  return binding;
}

export function getValidInputBindings(transition: Transition): ValidBindings {
  if (hasUnboundOutputVariables(transition.incoming, transition.outgoing)) {
    console.log("Early return: unbound output variables");
    return [];
  }

  if (hasMismatchedVariableTypes(transition.incoming, transition.outgoing)) {
    console.log("Early return: mismatched variable types");
    return [];
  }

  // If no incoming arcs, transition is always enabled
  if (transition.incoming.length === 0) {
    console.log("Early return: no incoming arcs");
    return [{}]; // For consistency, return array with one empty binding
  }

  const arcPlaceInfoDict: ArcPlaceInfoDict = Object.fromEntries(
    transition.incoming.map((arc) => [arc.id, buildArcPlaceInfo(arc)]),
  );

  // For each arcPlaceInfo, check if there are tokens available, otherwise return no bindings
  if (!hasAvailableTokensForAllArcs(arcPlaceInfoDict)) {
    console.log("Early return: missing tokens in non-inhibitor arcs");
    return [];
  }

  const inhibitorTokens = getInhibitorTokens(arcPlaceInfoDict);

  // Build binding candidates for each non-inhibitor arc
  const allArcBindingCandidates: Array<ArcBindingCandidates> = [];

  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (arcPlaceInfo.isInhibitorArc) continue;

    // More concise version than down below where we iterate over all tokens
    // const bindingCandidates: ArcBindingCandidates = arcPlaceInfo.token
    //   .filter((token) => !isTokenBlockedByInhibitor(token, inhibitorTokens)) // Skip tokens blocked by inhibitor arcs
    //   .map((token) =>
    //     buildBindingFromToken(token, arcPlaceInfo.dataClassInfoDict),
    //   );

    const bindingCandidates: ArcBindingCandidates = [];
    for (const token of arcPlaceInfo.token) {
      // Skip tokens blocked by inhibitor arcs
      // TODO: In the discussed example it should print that token Item_1 and (Order_1, Item_1) are blocked by inhibitor token Item_1
      // Currently only prints token Item_1 and Item_1
      if (isTokenBlockedByInhibitor(token, inhibitorTokens)) {
        console.log("Skipping token blocked by inhibitor arc:", token);
        continue;
      }

      // Build binding from token
      const binding: Binding = buildBindingFromToken(
        token,
        arcPlaceInfo.dataClassInfoDict,
      );
      bindingCandidates.push(binding);
    } // End for token

    if (bindingCandidates.length === 0) {
      return [];
    }

    allArcBindingCandidates.push(bindingCandidates);
  } // End for arcPlaceInfo

  console.log("allArcBindingCandidates", allArcBindingCandidates);
  return cartesianProduct(allArcBindingCandidates);
}

export function transitionIsEnabled(transition: Transition): boolean {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}
