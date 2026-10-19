import { OrthotypographyError } from "../errors.ts";
import {
  CURRENCIES,
  CURRENCY_REGISTRY_PROVENANCE,
  CURRENCY_REGISTRY_VERSION,
} from "./currency-data.ts";
import type { CurrencyDefinition } from "./currency-types.ts";

export { CURRENCIES, CURRENCY_REGISTRY_PROVENANCE, CURRENCY_REGISTRY_VERSION };
export type {
  CurrencyDefinition,
  CurrencyRegistryProvenance,
} from "./currency-types.ts";

export type CurrencySymbolAmbiguity = "unique" | "shared";

export interface CurrencySymbolDefinition {
  readonly symbol: string;
  readonly currencyCodes: readonly string[];
  readonly ambiguity: CurrencySymbolAmbiguity;
  readonly sourceId: "oqlf-currency-symbols";
}

export interface ResolvedCurrencyNotation {
  readonly notation: string;
  readonly kind: "code" | "symbol";
  readonly currencies: readonly CurrencyDefinition[];
  readonly ambiguous: boolean;
}

const symbolSourceId = "oqlf-currency-symbols" as const;

/** Editorial symbols are separate from ISO codes and may be ambiguous. */
export const CURRENCY_SYMBOLS: readonly CurrencySymbolDefinition[] = [
  {
    symbol: "€",
    currencyCodes: ["EUR"],
    ambiguity: "unique",
    sourceId: symbolSourceId,
  },
  {
    symbol: "$",
    currencyCodes: ["USD", "CAD"],
    ambiguity: "shared",
    sourceId: symbolSourceId,
  },
  {
    symbol: "£",
    currencyCodes: ["GBP"],
    ambiguity: "unique",
    sourceId: symbolSourceId,
  },
] as const;

const currenciesByCode = new Map<string, CurrencyDefinition>(
  CURRENCIES.map((currency) => [currency.code, currency] as const),
);
const symbolsByValue = new Map<string, CurrencySymbolDefinition>(
  CURRENCY_SYMBOLS.map((symbol) => [symbol.symbol, symbol] as const),
);

/** Resolves an exact uppercase ISO 4217 alphabetic code. */
export function resolveCurrencyCode(code: string): CurrencyDefinition | null {
  return currenciesByCode.get(code) ?? null;
}

/** Resolves an ISO code or editorial symbol without hiding ambiguity. */
export function resolveCurrencyNotation(
  notation: string,
): ResolvedCurrencyNotation | null {
  const currency = resolveCurrencyCode(notation);
  if (currency !== null) {
    return {
      notation,
      kind: "code",
      currencies: [currency],
      ambiguous: false,
    };
  }

  const symbol = symbolsByValue.get(notation);
  if (symbol === undefined) return null;
  const currencies = symbol.currencyCodes.map((code) => {
    const resolved = currenciesByCode.get(code);
    if (resolved === undefined) {
      throw new OrthotypographyError(
        "CATALOGUE_INCONSISTENCY",
        `Unknown currency code for symbol ${notation}: ${code}`,
      );
    }
    return resolved;
  });
  return {
    notation,
    kind: "symbol",
    currencies,
    ambiguous: symbol.ambiguity === "shared",
  };
}

export interface CurrencyRegistryIssue {
  readonly path: string;
  readonly message: string;
}

/** Validates uniqueness and symbol references in the monetary registry. */
export function validateCurrencyRegistry(): readonly CurrencyRegistryIssue[] {
  const issues: CurrencyRegistryIssue[] = [];
  const codes = new Set<string>();
  const numericCodes = new Set<string>();
  const symbols = new Set<string>();

  for (const currency of CURRENCIES) {
    if (!/^[A-Z]{3}$/.test(currency.code)) {
      issues.push({
        path: `currencies.${currency.code}`,
        message: "invalid code",
      });
    }
    if (!/^\d{3}$/.test(currency.numericCode)) {
      issues.push({
        path: `currencies.${currency.code}.numericCode`,
        message: "invalid numeric code",
      });
    }
    if (
      currency.minorUnit !== null &&
      (!Number.isInteger(currency.minorUnit) || currency.minorUnit < 0 ||
        currency.minorUnit > 9)
    ) {
      issues.push({
        path: `currencies.${currency.code}.minorUnit`,
        message: "invalid minor unit",
      });
    }
    if (codes.has(currency.code)) {
      issues.push({
        path: `currencies.${currency.code}`,
        message: "duplicate code",
      });
    }
    if (numericCodes.has(currency.numericCode)) {
      issues.push({
        path: `currencies.${currency.code}.numericCode`,
        message: "duplicate numeric code",
      });
    }
    codes.add(currency.code);
    numericCodes.add(currency.numericCode);
  }

  for (const symbol of CURRENCY_SYMBOLS) {
    if (symbols.has(symbol.symbol)) {
      issues.push({
        path: `symbols.${symbol.symbol}`,
        message: "duplicate symbol",
      });
    }
    symbols.add(symbol.symbol);
    for (const code of symbol.currencyCodes) {
      if (!codes.has(code)) {
        issues.push({
          path: `symbols.${symbol.symbol}.${code}`,
          message: "unknown currency code",
        });
      }
    }
    if ((symbol.currencyCodes.length > 1) !== (symbol.ambiguity === "shared")) {
      issues.push({
        path: `symbols.${symbol.symbol}.ambiguity`,
        message: "ambiguity does not match referenced currencies",
      });
    }
  }
  return issues;
}
