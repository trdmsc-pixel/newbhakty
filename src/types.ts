export interface VideoBlock {
  id: string;
  title: string;
  category: string;
  videoUrl: string;
  highResVideoUrl: string;
  description: string;
  creator: string;
  duration: string;
  ratio: "landscape" | "portrait" | "video-post";
  aspectRatioClass: string;
  tags: string[];
  type?: "video" | "image";
  imageUrl?: string;
  subtext?: string;
  page?: string;
  tab_id?: string;
}

export interface PortfolioTab {
  id: string;
  tab_title: string;
  tab_type: "video" | "image";
  page: string;
  display_order: number;
}

export interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  price: string;
  period: string;
  popular: boolean;
  deliverables: string[];
  turnaround: string;
  revisionRound: string;
  glowTheme: "saffron" | "violet" | "emerald";
  buttonLabel?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  discountEnabled?: boolean;
  discountText?: string;
  originalPrice?: string;
  offerText?: string;
  offerTextColor?: string;
  offerBgColor?: string;
  offerAnimation?: "shimmer" | "pulse" | "none";
  page?: string;
  is_slider_enabled?: boolean;
  slider_milestones?: Array<{ label: string; discount: number }>;
}

export interface BookingSubmission {
  name: string;
  company: string;
  email: string;
  brief: string;
  budget: string;
  selectedTier: string;
}
