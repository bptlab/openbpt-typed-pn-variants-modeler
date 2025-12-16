// Build valid input bindings for a transition (only real input arcs considered here).
// This function returns an array of binding objects mapping variableName -> array[value].
// These mapped arrays contain all values for one variableName that can be used to fire once.

import { is } from "../util/Util";

type TokenValue = {
  dataClassId: string;
  value: string;
};

type DataClassInfo = {
  isVariable: boolean;
  label: string;
  tokenValues: Array<string>;
};

type ArcPlaceInfo = {
  arcId: string;
  placeId: string;
  token: Array<TokenValue>;
  isInhibitorArc: boolean;
  isLinkingPlace: boolean;
  dataClassInfoDict: {
    [dataClassId: string]: DataClassInfo;
  };
};

function buildArcPlaceInfo(arc: any) {
  const arcId = arc.businessObject.id;
  const place = arc.businessObject.source;
  const placeId = place.id;
  const isInhibitorArc = arc.businessObject.isInhibitorArc || false;

  const dataClassInfoDict: {
    [dataClassId: string]: DataClassInfo;
  } = {};

  const marking = place.marking || [];
  for (const token of marking) {
    const tokenValues = token.values || [];
    for (const { dataClass, value } of tokenValues) {
      if (!dataClass) continue;
      if (!dataClassInfoDict[dataClass.id]) {
        dataClassInfoDict[dataClass.id] = {
          isVariable: false,
          label: "",
          tokenValues: [],
        };
      }
      const classInfo = dataClassInfoDict[dataClass.id];
      if (classInfo && !classInfo.tokenValues.includes(value)) {
        classInfo.tokenValues.push(value);
      }
    }
  }

  const inscription = arc.businessObject.inscription;
  if (inscription && inscription.inscriptionElements) {
    for (const element of inscription.inscriptionElements) {
      const dataClass = element.dataClass;
      if (dataClass && dataClassInfoDict[dataClass.id]) {
        const classInfo = dataClassInfoDict[dataClass.id];
        if (classInfo) {
          classInfo.isVariable = arc.businessObject.variableType === dataClass;
          classInfo.label = element.variableName;
        }
      }
    }
  }

  const customMarking: Array<TokenValue> = marking
    .map((token: any) => {
      const tokenValues: Array<TokenValue> = [];
      const values = token.values || [];
      for (const { dataClass, value } of values) {
        if (dataClass) {
          tokenValues.push({ dataClassId: dataClass.id, value });
        }
      }
      return tokenValues;
    })
    .flat();

  return {
    arcId,
    placeId,
    token: customMarking,
    isInhibitorArc,
    isLinkingPlace: Object.keys(dataClassInfoDict).length > 1,
    dataClassInfoDict,
  };
}

// TODO: transition invalid if input arc is variable and matching output arc is not variable and vice versa
// Returns true if one of outgoing arcs doesn't match incoming arc and is not generating
function isInvalidDueToOutputs(incomingArcs: any[], outgoingArcs: any[]) {
  const realInputVarNames = new Set();
  incomingArcs.forEach((arc) => {
    if (arc.businessObject.isInhibitorArc) return;
    const labels = (
      arc.businessObject?.inscription?.inscriptionElements || []
    ).map((el: any) => el.variableName);
    labels.forEach((l: string) => realInputVarNames.add(l));
  });

  for (const arc of outgoingArcs) {
    if (arc.businessObject.isInhibitorArc) continue;

    const elements = arc.businessObject.inscription?.inscriptionElements || [];
    const hasUnboundVariable = elements.some(
      (el: any) => !el.isGenerated && !realInputVarNames.has(el.variableName),
    ); // unbound = variable not generated and not as input

    if (hasUnboundVariable) return true;
  }

  return false;
}

export function getValidInputBindings(transition: any) {
  if (isInvalidDueToOutputs(transition.incoming, transition.outgoing)) {
    return [];
  }

  // If no incoming arcs, transition is always enabled
  if (transition.incoming.length === 0) {
    return [[]]; // For consistency, return array with one empty binding
  }

  const arcPlaceInfoMap: { [arcId: string]: ArcPlaceInfo } = {};
  for (const arc of transition.incoming) {
    arcPlaceInfoMap[arc.id] = buildArcPlaceInfo(arc);
  }

  // For each arcPlaceInfo, check if there are tokens available, otherwise return no bindings
  if (
    !Object.values(arcPlaceInfoMap).every(
      (arcPlaceInfo) => arcPlaceInfo.token.length > 0,
    )
  ) {
    return [];
  }

  const arcBindings: any = [];
  for (const arcPlaceInfo of Object.values(arcPlaceInfoMap)) {
  }

  return arcBindings;
}

export function transitionIsEnabled(transition: any): boolean {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}
