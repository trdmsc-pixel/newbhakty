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
}

export interface BookingSubmission {
  name: string;
  company: string;
  email: string;
  brief: string;
  budget: string;
  selectedTier: string;
}
