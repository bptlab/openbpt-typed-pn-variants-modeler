import { createDataClassCombinationKeyFromDict, getDataClassFromKey, getDataClassKey, tokensEqual } from "./bindingUtilsHelper";

/**
 * Builds a dictionary mapping arc IDs to their corresponding `ArcPlaceInfo` objects.
 * For each incoming arc, generates its `ArcPlaceInfo` and checks for existing data class combinations.
 * If a combination is new, adds the arc and its info to the dictionary.
 * If a combination already exists, merges tokens into the existing `ArcPlaceInfo` and updates its data class info.
 *
 * @param incomingArcs - An array of `Arc` objects to process.
 * @returns An `ArcPlaceInfoDict` mapping arc IDs to their `ArcPlaceInfo`.
 */
export function buildArcPlaceInfoDict(incomingArcs: Arc[]): ArcPlaceInfoDict{
  const arcPlaceInfoDict: ArcPlaceInfoDict = {};
  const existingDataClassCombinations: { [key: string]: string } = {};
  for (const arc of incomingArcs) {
    const arcPlaceInfo = buildArcPlaceInfo(arc);
    const dataClassCombination = createDataClassCombinationKeyFromDict(arcPlaceInfo.dataClassInfoDict);
    if (!existingDataClassCombinations[dataClassCombination]) {
      existingDataClassCombinations[dataClassCombination] = arc.id;
      arcPlaceInfoDict[arc.id] = arcPlaceInfo;
    }
    else {
      // Merge tokens into existing ArcPlaceInfo
      const existingArcId = existingDataClassCombinations[dataClassCombination];
      arcPlaceInfoDict[existingArcId].tokens = arcPlaceInfoDict[existingArcId].tokens.filter(token =>
        arcPlaceInfo.tokens.some(existingToken =>
          tokensEqual(token, existingToken)
        )
      );
      arcPlaceInfoDict[existingArcId].dataClassInfoDict = buildDataClassInfoDict(
        arcPlaceInfoDict[existingArcId].tokens, arcPlaceInfoDict[existingArcId].dataClassInfoDict
      );
    }
  }
  return arcPlaceInfoDict;
}

/**
 * Builds a dictionary mapping data class IDs to their corresponding `DataClassInfo` objects,
 * aggregating token values from the provided array of tokens. If an existing dictionary is supplied,
 * its `isVariable` and `alias` properties are preserved for matching data class IDs.
 *
 * Each token is expected to contain key-value pairs, where keys represent data class identifiers.
 * The function uses `getDataClassFromKey` to resolve the data class from each key.
 * For each data class, unique token values are collected into the `tokenValues` array.
 *
 * @param tokens - An array of `Token` objects containing key-value pairs for data classes.
 * @param existingDataClassInfoDict - An optional dictionary of existing `DataClassInfo` objects,
 *   used to preserve `isVariable` and `alias` properties for data classes already present.
 * @returns A dictionary mapping data class IDs to their aggregated `DataClassInfo` objects.
 */
function buildDataClassInfoDict(
  tokens: Token[], existingDataClassInfoDict: { [dataClassId: string]: DataClassInfo } = {}
): { [dataClassId: string]: DataClassInfo } {
  const dataClassInfoDict: { [dataClassId: string]: DataClassInfo } = {};

  for (const token of tokens) {
    for (const [dataClassKey, value] of Object.entries(token)) {
      const dataClass = getDataClassFromKey(dataClassKey);
      if (!dataClassInfoDict[dataClass.id]) {
        dataClassInfoDict[dataClass.id] = {
          isVariable: existingDataClassInfoDict[dataClass.id]?.isVariable ?? false,
          alias: existingDataClassInfoDict[dataClass.id]?.alias ?? "",
          tokenValues: [],
        };
      }

      if (!dataClassInfoDict[dataClass.id].tokenValues.includes(value)) {
        dataClassInfoDict[dataClass.id].tokenValues.push(value);
      }
    }
  }

  return dataClassInfoDict;
}

/**
 * Builds an `ArcPlaceInfo` object containing detailed information about the relationship
 * between an arc and its associated place, including marking tokens, data class info,
 * variable class, and arc properties.
 *
 * @param arc - The arc object for which to build place information.
 * @returns An `ArcPlaceInfo` object with the following properties:
 * - `arcId`: The unique identifier of the arc.
 * - `placeId`: The unique identifier of the associated place.
 * - `tokens`: An array of custom token objects representing the marking of the place.
 * - `isInhibitorArc`: Indicates if the arc is an inhibitor arc.
 * - `isLinkingPlace`: Indicates if the place links multiple data classes.
 * - `variableClass`: The data class used as a variable in the arc inscription, if any.
 * - `dataClassInfoDict`: A dictionary mapping data class IDs to their info, including
 *   variable status, alias, and token values.
 *
 * The function processes the marking tokens of the place, extracts data class information,
 * determines variable classes from arc inscriptions, and constructs a custom marking
 * representation for further simulation or analysis.
 */
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
          alias: "",
          tokenValues: [],
        };
      }

      if (!dataClassInfoDict[dataClass.id].tokenValues.includes(value)) {
        dataClassInfoDict[dataClass.id].tokenValues.push(value);
      }
    }
  }

  let variableClass: DataClass | undefined = undefined;
  const arcVariableType = arc.businessObject.variableType;
  const inscriptionElements =
    arc.businessObject.inscription?.inscriptionElements ?? [];
  for (const element of inscriptionElements) {
    const dataClass = element.dataClass;
    const dataClassInfo = dataClassInfoDict[dataClass.id];
    if (dataClass?.id && dataClassInfo) {
      if (arcVariableType === dataClass) {
        dataClassInfo.isVariable = true;
        variableClass = { id: dataClass.id, alias: dataClass.alias };
      }
      dataClassInfo.alias = element.variableName;
    }
  }

  const customMarking: Token[] = [];
  for (const token of marking) {
    const tokenObj: Token = {};
    const tokenValues = token.values ?? [];
    for (const { dataClass, value } of tokenValues) {
      tokenObj[getDataClassKey(dataClass.id, dataClass.alias, arcVariableType === dataClass)] = value
    }
    customMarking.push(tokenObj);
  }

  return {
    arcId: arc.id,
    placeId: place.id,
    tokens: customMarking,
    isInhibitorArc,
    isLinkingPlace: Object.keys(dataClassInfoDict).length > 1,
    variableClass,
    dataClassInfoDict,
  };
}

/**
 * Extracts and aggregates token values for each data class from non-linking arcs in the provided arc-place information dictionary.
 *
 * Iterates through all entries in the `arcPlaceInfoDict`, skipping those marked as linking places.
 * For each non-linking place, it collects token values for each data class, identified by a unique key
 * generated from the data class ID, alias, and variable status. Token values are accumulated per data class.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc-place identifiers to their corresponding information objects.
 * @returns An object mapping each unique data class key to an array of token values aggregated from non-linking arcs.
 */
export function getBindingPerDataClassFromNonLinkingArcs(arcPlaceInfoDict: ArcPlaceInfoDict): BindingPerDataClass {
  const bindingCandidatesPerDataClass: BindingPerDataClass = {};
    for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
      if (arcPlaceInfo.isLinkingPlace) continue;
      for (const [dataClassId, dataClassInfo] of Object.entries(arcPlaceInfo.dataClassInfoDict)) {
        const key = getDataClassKey(
          dataClassId,
          dataClassInfo.alias,
          dataClassInfo.isVariable,
        );
        bindingCandidatesPerDataClass[key] 
        ? bindingCandidatesPerDataClass[key].push(...dataClassInfo.tokenValues) 
        : bindingCandidatesPerDataClass[key] = [...dataClassInfo.tokenValues];
      }
    }
  return bindingCandidatesPerDataClass;
}