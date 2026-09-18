/**
 * The categorical palette for activity colours.
 *
 * These six slots are not a taste decision. They were selected by running the
 * data-viz palette validator against this app's two chart surfaces
 * (`#fffdf9` light, `#282320` dark) and keeping an ordering that clears every
 * hard gate in both modes:
 *
 *   - lightness band, chroma floor, contrast
 *   - adjacent-pair CVD separation (deuteranopia / protanopia / tritanopia)
 *   - adjacent-pair normal-vision separation (>= 15 OKLab dE)
 *
 * An earlier hand-picked "muted harmonious" set failed hard: `#7f9470` (moss)
 * and `#8a8073` (warm grey) sat at dE 6.0 for *normal* vision, meaning two
 * categories were hard to tell apart even with full colour vision, and
 * plum/blue were at dE 2.1 for deuteranopia. Muting for looks broke the data.
 *
 * Two constraints shaped the choice beyond the validator:
 *
 *   1. **No orange.** Clay (`--clay`) is the interface accent; an orange
 *      category would make an accent read as data.
 *   2. **Fixed order, never cycled.** The ordering *is* the CVD-safety
 *      mechanism — it is what makes neighbouring segments distinguishable — so
 *      the stacked bar must render segments in this order rather than sorted by
 *      size. Under arbitrary adjacency (`--pairs all`) this set does not clear
 *      the dark-mode gates, so the order is load-bearing.
 *
 * Dark mode is *selected*, not derived: each slot has its own step stepped for
 * the dark surface and validated as a set. Never auto-lighten these.
 */

export interface CategorySlot {
  /** Stable name, used for the seeded defaults. */
  readonly name: string;
  readonly light: string;
  readonly dark: string;
}

export const CATEGORY_SLOTS: readonly CategorySlot[] = [
  { name: "blue", light: "#2a78d6", dark: "#3987e5" },
  { name: "aqua", light: "#1baf7a", dark: "#199e70" },
  { name: "yellow", light: "#eda100", dark: "#c98500" },
  { name: "magenta", light: "#e87ba4", dark: "#d55181" },
  { name: "green", light: "#008300", dark: "#008300" },
  { name: "violet", light: "#4a3aa7", dark: "#9085e9" },
] as const;

/**
 * Neutral for the "Uncategorised" bucket. Deliberately outside the categorical
 * slots: it is an "Other" bucket, not a category, and should not compete with
 * one for identity.
 */
export const UNCATEGORISED_LIGHT = "#8a8073";
export const UNCATEGORISED_DARK = "#9d9184";

const DARK_BY_LIGHT = new Map<string, string>([
  ...CATEGORY_SLOTS.map((slot) => [slot.light.toLowerCase(), slot.dark] as const),
  [UNCATEGORISED_LIGHT, UNCATEGORISED_DARK],
]);

/**
 * The step to paint for a stored colour.
 *
 * Stored colours are the *light* steps. A colour the user picked themselves is
 * not in the map and is used unchanged in both modes — it has not been
 * validated, which is the honest outcome of letting anyone choose a colour.
 */
export function resolveCategoryColor(
  storedHex: string | null | undefined,
  isDark: boolean
): string {
  const hex = (storedHex ?? UNCATEGORISED_LIGHT).toLowerCase();
  if (!isDark) return hex;
  return DARK_BY_LIGHT.get(hex) ?? hex;
}

/**
 * A subordinate fill for sub-activity chips: the category colour mixed down
 * into the card surface.
 *
 * Sub-bars have to be *the parent's colour* so the relationship is obvious,
 * but they must not carry the same visual weight as the parent or the
 * hierarchy disappears. Mixing toward the surface keeps the hue and drops the
 * weight, and leaves the chip light enough for ink text at any of the six
 * slots — which matters because the validated palette spans #eda100 (yellow)
 * to #008300 (green), so a fixed text colour over a *full* fill would fail
 * one end or the other.
 *
 * `color-mix` does the work in the browser, so the mix stays correct in both
 * modes without a second lookup table.
 */
export function subActivityFill(color: string, isDark: boolean): string {
  const strength = isDark ? "42%" : "34%";
  return `color-mix(in oklab, ${color} ${strength}, var(--card))`;
}
