


export function getBiggestLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Link[] {
  const allLinks: Link[] = deduplicateLinks(getAllLinks(arcPlaceInfoDict));
  // Helper to check if linkA is a subset of linkB
  function linkIsSubset(linkA: Link, linkB: Link): boolean {
    const bSet = new Set(linkB.map(l => `${l.id}:${l.label}`));
    return linkA.every(l => bSet.has(`${l.id}:${l.label}`));
  }
  // Filter out links that are a subset of another link
  const biggestLinks = allLinks.filter((link, idx, arr) =>
    !arr.some((other, otherIdx) =>
      otherIdx !== idx && linkIsSubset(link, other) && other.length > link.length
    )
  );
  return biggestLinks;
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
      if (dataClassInfo.label) {
        link.push({ id: dataClassId, label: dataClassInfo.label });
      }
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
    const aSet = new Set(linkA.map(l => `${l.id}:${l.label}`));
    const bSet = new Set(linkB.map(l => `${l.id}:${l.label}`));
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

