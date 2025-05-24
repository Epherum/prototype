// src/app/utils/jsonBigInt.ts
import JSONbig from "json-bigint";

// Configure json-bigint to store BigInts as strings when parsing,
// and to correctly stringify BigInts from JS objects.
const JSONbigStoreAsString = JSONbig({
  storeAsString: true,
  alwaysParseAsBig: false,
  useNativeBigInt: true,
});
// useNativeBigInt: true -> if a number can fit in JS number, it's a number. If not, it's BigInt.
// storeAsString: true -> when it parses a number that becomes a BigInt, it stores it as a string in the resulting object.
// alwaysParseAsBig: false -> don't turn regular numbers into BigInts.

export function jsonBigIntReplacer(_key: any, value: any) {
  // This replacer is for when you use standard JSON.stringify
  // and want to ensure BigInts become strings.
  // JSONbig.stringify handles this internally.
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

// Export the configured stringify and parse methods
export const stringify = (data: any) => JSONbigStoreAsString.stringify(data);
export const parse = (jsonString: string) =>
  JSONbigStoreAsString.parse(jsonString);

// Your parseBigIntParam and parseBigInt are for backend API route param parsing,
// they are separate from the JSON parsing/reviving. Keep them if used there.
export function parseBigIntParam(
  value: string,
  paramName: string
): bigint | null {
  if (!value || typeof value !== "string" || value.trim() === "") {
    console.warn(
      `Invalid ${paramName}: Value is null, undefined, or empty string ('${value}').`
    );
    return null;
  }
  try {
    const result = BigInt(value);
    return result;
  } catch (e) {
    console.warn(
      `Invalid ${paramName} format: '${value}'. Could not convert to BigInt. Error:`,
      (e as Error).message
    );
    return null;
  }
}

export function parseBigInt( // This one might be redundant if parseBigIntParam is used
  value: string | null | undefined,
  paramName: string
): bigint | null {
  if (value === null || value === undefined) return null;
  try {
    return BigInt(value);
  } catch (e) {
    console.warn(
      // Consider a more generic source than "API /partners/[id]"
      `Util parseBigInt: Invalid ${paramName} '${value}'. Not a valid BigInt.`
    );
    return null;
  }
}
