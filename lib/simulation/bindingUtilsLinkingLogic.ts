/**
 * Returns the largest (non-overlapping and non-subset) links from the given arc-place information dictionary.
 *
 * This function performs the following steps:
 * 1. Collects and deduplicates all links from the provided `arcPlaceInfoDict`.
 * 2. Iteratively merges any overlapping links (links that share at least one element).
 * 3. Removes any links that are strict subsets of other links, ensuring only the largest unique links remain.
 *
 * @param arcPlaceInfoDict - A dictionary containing arc-place information used to extract and process links.
 * @returns An array of the largest, non-overlapping, and non-subset links.
 */
export function getBiggestLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Link[] {
  let allLinks: Link[] = deduplicateLinks(getAllLinks(arcPlaceInfoDict));

  // Helper to check if two links overlap (share at least one element)
  function linksOverlap(linkA: Link, linkB: Link): boolean {
    const aSet = new Set(linkA.map(l => `${l.id}:${l.alias}:${l.isVariable}`));
    return linkB.some(l => aSet.has(`${l.id}:${l.alias}:${l.isVariable}`));
  }

  // Helper to merge two links (union of elements, order-insensitive)
  function mergeLinks(linkA: Link, linkB: Link): Link {
    const map = new Map<string, Link[0]>();
    for (const l of linkA) {
      map.set(`${l.id}:${l.alias}:${l.isVariable}`, l);
    }
    for (const l of linkB) {
      map.set(`${l.id}:${l.alias}:${l.isVariable}`, l);
    }
    return Array.from(map.values());
  }

  // Iteratively merge overlapping links
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < allLinks.length; i++) {
      for (let j = i + 1; j < allLinks.length; j++) {
        if (linksOverlap(allLinks[i], allLinks[j])) {
          const mergedLink = mergeLinks(allLinks[i], allLinks[j]);
          // Remove the two links and add the merged one
          allLinks.splice(j, 1);
          allLinks.splice(i, 1, mergedLink);
          merged = true;
          break outer;
        }
      }
    }
  }

  // Remove subset links
  const biggestLinks = allLinks.filter((link, idx, arr) =>
    !arr.some((other, otherIdx) =>
      otherIdx !== idx &&
      link.every(l =>
        other.some(ol => ol.id === l.id && ol.alias === l.alias && ol.isVariable === l.isVariable)
      ) &&
      other.length > link.length
    )
  );

  return biggestLinks;
}

/**
 * Extracts all links from the provided ArcPlaceInfoDict.
 *
 * Iterates through each entry in the given dictionary, and for each entry that represents
 * a linking place, constructs a Link object by collecting the data class information.
 * Each Link consists of objects containing the data class ID, its alias, and whether it is a variable.
 * Returns an array of all such Link objects found.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc place identifiers to their corresponding ArcPlaceInfo objects.
 * @returns An array of Link objects, each representing the data class links for a linking place.
 */
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

/**
 * Removes duplicate links from the provided array, treating links as duplicates if they contain the same elements,
 * regardless of order. Two links are considered equal if they have the same length and contain the same set of
 * elements (based on `id`, `alias`, and `isVariable` properties).
 *
 * @param links - An array of `Link` arrays to deduplicate.
 * @returns A new array containing only unique links, with duplicates removed (order-insensitive).
 */
function deduplicateLinks(links: Link[]): Link[] {
  const uniqueLinks: Link[] = [];
  // Helper to compare two links for set equality (order-insensitive)
  function linksAreEqual(linkA: Link, linkB: Link): boolean {
    if (linkA.length !== linkB.length) return false;
    const aSet = new Set(linkA.map(l => `${l.id}:${l.alias}:${l.isVariable}`));
    const bSet = new Set(linkB.map(l => `${l.id}:${l.alias}:${l.isVariable}`));
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

/**
 * Extracts and organizes link tokens and place IDs from the provided arc-place information dictionary.
 *
 * Iterates through all entries in the `arcPlaceInfoDict`, collecting link tokens for places marked as linking places.
 * For each linking place, it creates a mapping of place IDs to their associated link tokens, and also builds a mapping
 * from a composite data class key (based on alias, data class ID, and variable status) to the corresponding place IDs.
 *
 * @param arcPlaceInfoDict - A dictionary containing information about arc places, keyed by place ID.
 * @returns A tuple containing:
 *   - `LinkTokenPerPlace`: An object mapping each linking place ID to an array of its link tokens.
 *   - `PlaceIdPerDataClass`: An object mapping a composite data class key to an array of place IDs associated with that data class.
 */
export function getAllLinkToken(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): [LinkTokenPerPlace, PlaceIdPerDataClass] {
  const linkTokenPerPlace: LinkTokenPerPlace = {};
  const placeIdPerDataClass: PlaceIdPerDataClass = {};

  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isLinkingPlace) continue;

    const linkTokens: LinkToken[] = [];
    for (const token of arcPlaceInfo.tokens) {
      linkTokens.push({
      variableType: arcPlaceInfo.variableClass,
      token: token,
      });
    }
    linkTokenPerPlace[arcPlaceInfo.placeId] = linkTokens;
    
    const placeId = arcPlaceInfo.placeId;
      for (const [dataClassId, dataClassInfo] of Object.entries(arcPlaceInfo.dataClassInfoDict)) {
        const key = `${dataClassInfo.alias}:${dataClassId}:${dataClassInfo.isVariable}`;
        if (!placeIdPerDataClass[key]) {
          placeIdPerDataClass[key] = [];
        }
        placeIdPerDataClass[key].push(placeId);
      }
  }

  return [linkTokenPerPlace, placeIdPerDataClass];
}
