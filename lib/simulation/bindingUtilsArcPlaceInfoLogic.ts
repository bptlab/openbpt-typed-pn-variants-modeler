import { tokensEqual } from "./bindingUtilsHelper";

/**
 * Builds a dictionary mapping arc IDs to their corresponding `ArcPlaceInfo` objects,
 * ensuring that only unique data class combinations are represented.
 * 
 * For each incoming arc, the function generates its `ArcPlaceInfo` and a key representing
 * its data class combination. If this combination has not been encountered before, the arc's
 * info is added to the dictionary. If the combination already exists, the function merges
 * tokens into the existing entry by filtering tokens to those present in both the existing
 * and new arc, and updates the data class info dictionary accordingly.
 * 
 * @param incomingArcs - An array of `Arc` objects to process.
 * @returns An `ArcPlaceInfoDict` mapping arc IDs to their unique `ArcPlaceInfo` objects.
 */
export function buildArcPlaceInfoDict(incomingArcs: Arc[]): [ArcPlaceInfoDict, TokenStructure]{
  const arcPlaceInfoDict: ArcPlaceInfoDict = {};
  const tokenStructure: TokenStructure = new Set<Link>();
  const existingDataClassCombinations: { [key: string]: string } = {};
  for (const arc of incomingArcs) {
    const arcPlaceInfo = buildArcPlaceInfo(arc);
    const dataClassCombination = createDataClassCombinationKey(arcPlaceInfo.dataClassInfoDict);
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
    tokenStructure.add(getArcTokenStructure(arcPlaceInfo.dataClassInfoDict));
  }
  return [arcPlaceInfoDict, tokenStructure];
}

/**
 * Generates a unique string key representing a combination of data classes.
 *
 * The key is constructed by iterating over the entries of the provided `dataClassInfoDict`,
 * sorting them by their keys, and concatenating each entry's `dataClassId`, `alias`, and
 * `isVariable` property, separated by colons. Each entry is delimited by a double colon (`::`).
 * The trailing delimiter is removed from the final key.
 *
 * @param dataClassInfoDict - An object mapping data class IDs to their corresponding `DataClassInfo`.
 * @returns A string key uniquely identifying the combination of data classes and their properties.
 */
function createDataClassCombinationKey(dataClassInfoDict: { [dataClassId: string]: DataClassInfo }): string {
  let key: string = "";
  for (const [dataClassId, dataClassInfo] of Object.entries(dataClassInfoDict).sort()) {
    key += `${dataClassId}:${dataClassInfo.alias}:${dataClassInfo.isVariable}::`;
  }
  return key.endsWith("::") ? key.slice(0, -2) : key;
}

/**
 * Builds a dictionary mapping data class IDs to their corresponding `DataClassInfo` objects,
 * aggregating token values for each data class from the provided tokens.
 * 
 * If an existing dictionary is provided, it preserves the `isVariable` and `alias` properties
 * for each data class, otherwise defaults are used.
 * 
 * @param tokens - An array of `Token` objects, each containing data class and value information.
 * @param existingDataClassInfoDict - An optional dictionary of existing `DataClassInfo` objects,
 *   keyed by data class ID, used to preserve certain properties.
 * @returns A dictionary mapping data class IDs to their aggregated `DataClassInfo` objects,
 *   including all unique token values found in the input tokens.
 */
function buildDataClassInfoDict(
  tokens: Token[], existingDataClassInfoDict: { [dataClassId: string]: DataClassInfo } = {}
): { [dataClassId: string]: DataClassInfo } {
  const dataClassInfoDict: { [dataClassId: string]: DataClassInfo } = {};

  for (const token of tokens) {
    for (const { dataClass, value } of token) {
      if (!dataClass) continue;

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
 * Builds detailed information about the relationship between an arc and its associated place,
 * including token markings, data class information, and variable class details.
 *
 * @param arc - The arc object containing business logic and references to source places and inscriptions.
 * @returns An `ArcPlaceInfo` object containing:
 *   - `arcId`: The unique identifier of the arc.
 *   - `placeId`: The unique identifier of the associated place.
 *   - `tokens`: A custom marking array representing the tokens and their values for the place.
 *   - `isInhibitorArc`: Indicates if the arc is an inhibitor arc.
 *   - `isLinkingPlace`: True if the place is associated with more than one data class.
 *   - `variableClass`: The data class used as a variable in the arc's inscription, if any.
 *   - `dataClassInfoDict`: A dictionary mapping data class IDs to their information, including variable status, alias, and token values.
 *
 * The function processes the place's marking and the arc's inscription elements to extract and organize
 * data class information, variable usage, and token values for further simulation or analysis.
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
  const inscriptionElements =
    arc.businessObject.inscription?.inscriptionElements ?? [];
  for (const element of inscriptionElements) {
    const dataClass = element.dataClass;
    const dataClassInfo = dataClassInfoDict[dataClass.id];
    if (dataClass?.id && dataClassInfo) {
      if (arc.businessObject.variableType === dataClass) {
        dataClassInfo.isVariable = true;
        variableClass = { id: dataClass.id, alias: dataClass.alias };
      }
      dataClassInfo.alias = element.variableName;
    }
  }

  const customMarking: Token[] = [];
  for (const token of marking) {
    const tokenObj: Token = [];
    const tokenValues = token.values ?? [];
    for (const { dataClass, value } of tokenValues) {
      tokenObj.push({ dataClass: { id: dataClass.id, alias: dataClass.alias }, value: value });
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
 * Generates a token structure for arcs based on the provided data class information dictionary.
 *
 * Iterates over each entry in the `dataClassInfoDict` and constructs a `Link` array,
 * where each element contains the `id` (data class ID), `alias`, and `isVariable` properties
 * from the corresponding `DataClassInfo` object.
 *
 * @param dataClassInfoDict - An object mapping data class IDs to their corresponding `DataClassInfo`.
 * @returns A `Link` array representing the token structure for the arcs.
 */
function getArcTokenStructure(dataClassInfoDict: { [dataClassId: string]: DataClassInfo }): Link {
  const arcTokenStructure: Link = [];
  for (const [dataClassId, dataClassInfo] of Object.entries(
    dataClassInfoDict,
  )) {
    arcTokenStructure.push({ id: dataClassId, alias: dataClassInfo.alias, isVariable: dataClassInfo.isVariable });
  }
  return arcTokenStructure;
}