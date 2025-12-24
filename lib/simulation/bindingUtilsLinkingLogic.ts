import { createDataClassCombinationKeyFromDict, createDataClassCombinationKeyFromLink, getDataClassKey, tokensOverlap } from "./bindingUtilsHelper";

export function getBiggestLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): [Link[], Link[]] {
  const allLinks: Link[] = deduplicateLinks(getAllLinks(arcPlaceInfoDict));
  let tempLinks = [...allLinks];

  // Helper to check if two links overlap (share at least one element)
  function linksOverlap(linkA: Link, linkB: Link): boolean {
    const aSet = new Set(linkA.map(l => getDataClassKey(l.id, l.alias, l.isVariable)));
    return linkB.some(l => aSet.has(getDataClassKey(l.id, l.alias, l.isVariable)));
  }

  // Helper to merge two links (union of elements, order-insensitive)
  function mergeLinks(linkA: Link, linkB: Link): Link {
    const map = new Map<string, Link[0]>();
    for (const l of linkA) {
      map.set(getDataClassKey(l.id, l.alias, l.isVariable), l);
    }
    for (const l of linkB) {
      map.set(getDataClassKey(l.id, l.alias, l.isVariable), l);
    }
    return Array.from(map.values());
  }

  // Iteratively merge overlapping links
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < tempLinks.length; i++) {
      for (let j = i + 1; j < tempLinks.length; j++) {
        if (linksOverlap(tempLinks[i], tempLinks[j])) {
          const mergedLink = mergeLinks(tempLinks[i], tempLinks[j]);
          // Remove the two links and add the merged one
          tempLinks.splice(j, 1);
          tempLinks.splice(i, 1, mergedLink);
          merged = true;
          break outer;
        }
      }
    }
  }

  // Remove subset links
  const biggestLinks = tempLinks.filter((link, idx, arr) =>
    !arr.some((other, otherIdx) =>
      otherIdx !== idx &&
      link.every(l =>
        other.some(ol => ol.id === l.id && ol.alias === l.alias && ol.isVariable === l.isVariable)
      ) &&
      other.length > link.length
    )
  );

  return [biggestLinks, allLinks];
}


function getAllLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Link[] {
  const allLinks: Link[] = [];
  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isLinkingPlace) continue;
    const link: Link = [];
    for (const [dataClassId, dataClassInfo] of Object.entries(
      arcPlaceInfo.dataClassInfoDict,
    )) {
      link.push({ id: dataClassId, alias: dataClassInfo.alias, isVariable: dataClassInfo.isVariable });
    }
    allLinks.push(link);
  }
  return allLinks;
}


function deduplicateLinks(links: Link[]): Link[] {
  const uniqueLinks: Link[] = [];
  // Helper to compare two links for set equality (order-insensitive)
  function linksAreEqual(linkA: Link, linkB: Link): boolean {
    if (linkA.length !== linkB.length) return false;
    const aSet = new Set(linkA.map(l => getDataClassKey(l.id, l.alias, l.isVariable)));
    const bSet = new Set(linkB.map(l => getDataClassKey(l.id, l.alias, l.isVariable)));
    if (aSet.size !== bSet.size) return false;
    for (const item of aSet) {
      if (!bSet.has(item)) return false;
    }
    return true;
  }
  // Remove duplicates (order-insensitive)
  for (const link of links) {
    if (!uniqueLinks.some(existing => linksAreEqual(existing, link))) {
      uniqueLinks.push(link);
    }
  }
  return uniqueLinks;
}


export function getTokenPerLink(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): TokenPerLink {
  const tokenPerLink: TokenPerLink = {};
  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isLinkingPlace) continue;
    const key = createDataClassCombinationKeyFromDict(arcPlaceInfo.dataClassInfoDict);
    tokenPerLink[key] = [];
    for (const token of arcPlaceInfo.tokens) {
      tokenPerLink[key].push(token);
    }
  }
  return tokenPerLink;
}


export function getBindingsForLink(
  link: Link,
  allLinks: Link[],
  tokenPerLink: TokenPerLink,
  bindingPerDataClassFromNonLinkingArcs: BindingPerDataClass,
): BindingPerDataClass[] {
  
  // get all links associated with the current link
  const associatedLinks: Link[] = allLinks.filter(l =>
    l.some(le => link.some(ce =>
      le.id === ce.id &&
      le.alias === ce.alias &&
      le.isVariable === ce.isVariable
    ))
  );
  
  // Step 1: get biggest link tokens (tokens that have values for all dataclasses in the link)
  const biggestLinkTokens: Token[] = [];
  if (associatedLinks.length === 1) {
    biggestLinkTokens.push(...tokenPerLink[createDataClassCombinationKeyFromLink(link)]);
  }
  else {
    biggestLinkTokens.push(...getLinkToken(associatedLinks, tokenPerLink));
  }
  // group tokens by unique links of non variable dataclasses
  const groupedTokens: {[key: string]: BindingPerDataClass} = {};
  for (const token of biggestLinkTokens) {
    let groupKey = "";
    for (const linkElement of link) {
      if (!linkElement.isVariable) {
        const dataClassKey = getDataClassKey(linkElement.id, linkElement.alias, linkElement.isVariable);
        groupKey += `${dataClassKey}:${token[dataClassKey]}::`;
      }
    }
    groupKey = groupKey.endsWith("::") ? groupKey.slice(0, -2) : groupKey;
    if (!groupedTokens[groupKey]) {
      groupedTokens[groupKey] = {};
      for (const linkElement of link) {
        const dataClassKey = getDataClassKey(linkElement.id, linkElement.alias, linkElement.isVariable);
        groupedTokens[groupKey][dataClassKey] = linkElement.isVariable ? [] : [token[dataClassKey]];
      }
    }
    for (const linkElement of link) {
      if (linkElement.isVariable) {
        const dataClassKey = getDataClassKey(linkElement.id, linkElement.alias, linkElement.isVariable);
        groupedTokens[groupKey][dataClassKey].push(token[dataClassKey]);
      }
    }
  }

  // Step 2: create bindings for the link
  const bindings: BindingPerDataClass[] = [];

  for (const binding of Object.values(groupedTokens)) {
    // filter binding to only include candidates from non-linking arcs
    const filteredBinding: BindingPerDataClass = {};
    for (const [dataClassKey, values] of Object.entries(binding)) {
      filteredBinding[dataClassKey] = values.filter(v =>
        bindingPerDataClassFromNonLinkingArcs[dataClassKey] &&
        bindingPerDataClassFromNonLinkingArcs[dataClassKey].includes(v) ||
        !bindingPerDataClassFromNonLinkingArcs[dataClassKey]
      );
    }
    // If any dataClassKey has an empty array, skip this binding
    if (Object.values(filteredBinding).some(arr => arr.length === 0)) {
      continue;
    }
    bindings.push(filteredBinding);
  }
  console.log("Bindings for link in getBindingsForLink:", bindings);
  return bindings;
}

function getLinkToken(associatedLinks: Link[], tokenPerLink: TokenPerLink): Token[] {
  let mergedToken: Token[] = [];
  let mergedLink: Link = [];
  let overlapDataClassKeys: string[] = [];
  let overlapIndex: number | null = null;
  
  mergedLink = associatedLinks[0];
  mergedToken = tokenPerLink[createDataClassCombinationKeyFromLink(mergedLink)];
  associatedLinks.splice(0, 1);

  while (associatedLinks.length > 0) {
    [overlapIndex, overlapDataClassKeys] = getFirstOverlap(mergedLink, associatedLinks);
    if (overlapIndex === -1) {
    }
    const linkToMerge = associatedLinks[overlapIndex];
    mergedLink = mergeLinks(
      mergedLink,
      linkToMerge,
    );
    mergedToken = mergeLinkToken(
      mergedToken,
      tokenPerLink[createDataClassCombinationKeyFromLink(linkToMerge)],
      overlapDataClassKeys
    );
    associatedLinks.splice(overlapIndex, 1);
  }

  return mergedToken;
}

function getFirstOverlap(link: Link, links: Link[]): [number, string[]] {
  for (let i = 0; i < links.length; i++) {
    const aKeys = new Set(link.map(l => getDataClassKey(l.id, l.alias, l.isVariable)));
    const bKeys = new Set(links[i].map(l => getDataClassKey(l.id, l.alias, l.isVariable)));
    const overlap = Array.from(aKeys).filter(key => bKeys.has(key));
    if (overlap.length > 0) {
      return [i, overlap];
    }
  }
  return [-1, []];
}

function mergeLinks(linkA: Link, linkB: Link): Link {
  const map = new Map<string, Link[0]>();
  for (const l of linkA) {
    map.set(getDataClassKey(l.id, l.alias, l.isVariable), l);
  }
  for (const l of linkB) {
    map.set(getDataClassKey(l.id, l.alias, l.isVariable), l);
  }
  return Array.from(map.values());
}

function mergeLinkToken(
  linkTokensA: Token[],
  linkTokensB: Token[],
  overlapDataClassKeys: string[],
): Token[] {
  const mergedLinkTokens: Token[] = [];

  for (const tokenA of linkTokensA) {
    for (const tokenB of linkTokensB) {
      if (tokensOverlap(tokenA, tokenB, overlapDataClassKeys)) {
        
        // Merge tokens: combine all key-value pairs, starting with tokenA
        const mergedToken: Token = { ...tokenA };

        // Add non-overlapping keys from tokenB
        for (const key of Object.keys(tokenB)) {
          if (!(key in mergedToken)) {
            mergedToken[key] = tokenB[key];
          }
        }
        mergedLinkTokens.push(mergedToken);
      }
    }
  }

  return mergedLinkTokens;
}


export function cartesianProductBindings(bindingCandidatesPerLink: BindingPerDataClass[][]): BindingPerDataClass[] {
  if (bindingCandidatesPerLink.length === 0) return [];
  return bindingCandidatesPerLink.reduce((acc, curr) => {
    const result: BindingPerDataClass[] = [];
    for (const a of acc) {
      for (const b of curr) {
        result.push({ ...a, ...b });
      }
    }
    return result;
  }, [{}]);
}


export function getDataClassesNotInLinks(bindingPerDataClassFromNonLinkingArcs: BindingPerDataClass, biggestLinks: Link[]): Set<string> {
  const dataClassesNotInLinks: Set<string> = new Set();
  for (const dataClassKey of Object.keys(bindingPerDataClassFromNonLinkingArcs)) {
    let usedInLink = false;
    for (const link of biggestLinks) {
      for (const linkElement of link) {
        const linkDataClassKey = getDataClassKey(linkElement.id, linkElement.alias, linkElement.isVariable);
        if (dataClassKey === linkDataClassKey) {
          usedInLink = true;
          break;
        }
      }
      if (usedInLink) break;
    }
    if (!usedInLink) {
      dataClassesNotInLinks.add(dataClassKey);
    }
  }
  return dataClassesNotInLinks;
}