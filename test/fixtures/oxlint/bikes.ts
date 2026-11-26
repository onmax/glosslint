// Find a free Re-charge point.
export const label = "Re-charge point at the rack";
export const reChargePoint = 1;
export const ignored = endsWith("Re-charge point");

function endsWith(text: string): boolean {
  return text.length > 0;
}
