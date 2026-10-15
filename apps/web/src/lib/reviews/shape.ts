/** Small helpers shared by the review services. */

/** `Review.photoUrls` is JSON: keep only the strings. */
export const photoList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((u): u is string => typeof u === 'string') : []
