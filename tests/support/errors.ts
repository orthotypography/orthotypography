import assert from "node:assert/strict";
import { type ErrorCode, OrthotypographyError } from "../../src/mod.ts";

/** Asserts that a call throws an `OrthotypographyError` with a given code. */
export function assertCode(run: () => unknown, code: ErrorCode): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof OrthotypographyError, String(error));
    assert.equal(error.code, code, error.message);
    return true;
  });
}
