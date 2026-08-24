/**
 * LCKED — Bulk action reporting.
 *
 * The single toast ladder for every bulk Item action. Store actions resolve
 * to a uniform BulkResult and never reject for row-level failures; this
 * helper owns the await, the copy, and the catch. Callers keep flow control
 * (e.g. exiting multi-select) on their side of the seam.
 */

import { toast } from "sonner";

import type { BulkResult } from "@/lib/types";

const plural = (n: number, what: string) => `${what}${n === 1 ? "" : "s"}`;

/** Copy options: "Moved" + tail "to Trash" → "Moved 3 items to Trash". */
export interface BulkCopy {
 /** Counted noun; defaults to "item". */
 what?: string;
 /** Trailing phrase appended after the noun ("to Trash", "to Work"). */
 tail?: string;
}

export async function runBulk(
 action: () => Promise<BulkResult>,
 did: string,
 copy: BulkCopy = {},
): Promise<BulkResult> {
 const what = copy.what ?? "item";
 const tail = copy.tail ? ` ${copy.tail}` : "";
 let result: BulkResult;
 try {
  result = await action();
 } catch {
  toast.error(`${did} failed`);
  return { done: 0, failed: 0 };
 }

 const { done, failed } = result;
 if (done === 0 && failed === 0) return result;
 if (failed === 0) {
  toast.success(`${did} ${done} ${plural(done, what)}${tail}`);
 } else if (done === 0) {
  toast.error(`${did} nothing; ${failed} ${plural(failed, what)} failed`);
 } else {
  toast.warning(
   `${did} ${done} ${plural(done, what)}${tail}; ${failed} failed`,
  );
 }
 return result;
}
