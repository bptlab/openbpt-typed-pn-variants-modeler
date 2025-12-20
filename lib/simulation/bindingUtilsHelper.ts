/**
 * Determines whether two tokens are equal by comparing their lengths and ensuring that
 * every element in the first token has a corresponding element in the second token with
 * matching `dataClass.id`, `dataClass.alias`, and `value`.
 *
 * @param tokenA - The first token to compare, represented as an array of objects.
 * @param tokenB - The second token to compare, represented as an array of objects.
 * @returns `true` if both tokens are equal in length and content; otherwise, `false`.
 */
export function tokensEqual(tokenA: Token, tokenB: Token): boolean {
  return (
    tokenA.length === tokenB.length &&
    tokenA.every((tokenAValue) => {
      return tokenB.some((tokenBValue) =>
        tokenAValue.dataClass.id === tokenBValue.dataClass.id &&
        tokenAValue.dataClass.alias === tokenBValue.dataClass.alias &&
        tokenAValue.value === tokenBValue.value,
      );
    })
  );
}