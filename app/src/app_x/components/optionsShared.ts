import type { Category, StreamCategory } from "../config/types";

const PREFERRED_DEFAULT_CATEGORY: StreamCategory = "NCAAB";

export function getDefaultCategory(categories: readonly StreamCategory[]): Category {
  if (categories.includes(PREFERRED_DEFAULT_CATEGORY)) {
    return PREFERRED_DEFAULT_CATEGORY;
  }

  return categories[0] ?? "ALL";
}
