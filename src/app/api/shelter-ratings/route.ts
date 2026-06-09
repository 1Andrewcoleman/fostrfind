import { createRatingHandler } from '@/lib/rating-route'

/**
 * POST /api/shelter-ratings — foster rates a shelter after a completed
 * placement. Guard chain and insert logic live in `src/lib/rating-route.ts`,
 * shared with the mirror endpoint `/api/ratings`.
 */
export const POST = createRatingHandler({
  table: 'shelter_ratings',
  rater: 'foster',
  rateLimitKey: 'shelter-ratings:post',
  logTag: 'shelter-ratings/post',
})
