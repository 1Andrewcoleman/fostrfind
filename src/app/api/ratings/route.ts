import { createRatingHandler } from '@/lib/rating-route'

/**
 * POST /api/ratings — shelter rates a foster after a completed placement.
 * Guard chain and insert logic live in `src/lib/rating-route.ts`, shared
 * with the mirror endpoint `/api/shelter-ratings`.
 */
export const POST = createRatingHandler({
  table: 'ratings',
  rater: 'shelter',
  rateLimitKey: 'ratings:post',
  logTag: 'ratings/post',
})
