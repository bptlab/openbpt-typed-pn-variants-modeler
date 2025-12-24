import { createDataClassCombinationKeyFromDict, getDataClassFromKey, getDataClassKey, tokensEqual } from "./bindingUtilsHelper";

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


export function getArcTokenStructure(dataClassInfoDict: { [dataClassId: string]: DataClassInfo }): Link {
  const arcTokenStructure: Link = [];
  for (const [dataClassId, dataClassInfo] of Object.entries(
    dataClassInfoDict,
  )) {
    arcTokenStructure.push({ id: dataClassId, alias: dataClassInfo.alias, isVariable: dataClassInfo.isVariable });
  }
  return arcTokenStructure;
}

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