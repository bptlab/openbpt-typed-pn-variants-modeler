/**
 * Retrieves all tokens associated with inhibitor arcs from the provided arc-place information dictionary.
 *
 * Iterates through the given `arcPlaceInfoDict`, collects tokens from entries where `isInhibitorArc` is `true`,
 * and returns a flat array of these tokens.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc-place identifiers to their corresponding information, including tokens and inhibitor status.
 * @returns An array of tokens that are associated with inhibitor arcs.
 */
function getInhibitorTokens(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Token[] {
  const inhibitorTokens: Token[] = [];

  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isInhibitorArc) continue;

    inhibitorTokens.push(...arcPlaceInfo.tokens);
  }

  return inhibitorTokens;
}


// function isTokenBlockedByInhibitor(
//   token: TokenValue,
//   inhibitorTokens: TokenValue[],
// ): boolean {
//   return inhibitorTokens.some((inhibitorToken) =>
//     tokensEqual(token, inhibitorToken),
//   );
// }


