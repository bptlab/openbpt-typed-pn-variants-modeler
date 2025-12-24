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
  // Assuming the new Token implementation is: type Token = Record<string, string>
  // where the key is a dataClassKey and the value is the token value.

  const tokenAKeys = Object.keys(tokenA);
  const tokenBKeys = Object.keys(tokenB);

  return tokenAKeys.length !== tokenBKeys.length
  ? false
  : tokenAKeys.every(key => tokenB.hasOwnProperty(key) && tokenA[key] === tokenB[key]);
}

export function tokensOverlap(tokenA: Token, tokenB: Token, dataClassKeys: string[]): boolean {
  for (const key of dataClassKeys) {
    if (!(key in tokenA) || !(key in tokenB) || tokenA[key] !== tokenB[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Generates a unique key for a data class based on its identifier, alias, and variable status.
 *
 * @param id - The unique identifier for the data class.
 * @param alias - The alias or alternative name for the data class.
 * @param isVariable - Indicates whether the data class represents a variable.
 * @returns A string key in the format `${id}:${alias}:${isVariable}`.
 */
export function getDataClassKey(id: string, alias: string, isVariable: boolean): string {
  return `${id}:${alias}:${isVariable}`;
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
export function createDataClassCombinationKeyFromDict(dataClassInfoDict: { [dataClassId: string]: DataClassInfo }): string {
  let key: string = "";
  for (const [dataClassId, dataClassInfo] of Object.entries(dataClassInfoDict).sort()) {
    key += getDataClassKey(dataClassId, dataClassInfo.alias, dataClassInfo.isVariable) + "::";
  }
  return key.endsWith("::") ? key.slice(0, -2) : key;
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
export function createDataClassCombinationKeyFromLink(link: Link): string {
  let key: string = "";
  for (const linkElement of [...link].sort((a, b) => a.id.localeCompare(b.id))) {
    key += getDataClassKey(linkElement.id, linkElement.alias, linkElement.isVariable) + "::";
  }
  return key.endsWith("::") ? key.slice(0, -2) : key;
}

export function getDataClassFromKey(dataClassKey: string): DataClass {
  const [id, alias, isVariableStr] = dataClassKey.split(":");
  return { id, alias };
}