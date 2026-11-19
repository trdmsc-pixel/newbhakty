import { VideoBlock, PricingTier } from "./types";

// Empty fallback: Real studio works are loaded dynamically from Supabase `portfolio_works`.
// No demo/stock footage (mixkit.co) is served on the live site.
export const PORTFOLIO_VIDEOS: VideoBlock[] = [];

// Pricing tiers are retired from the public site.
export const PRICING_TIERS: PricingTier[] = [];
