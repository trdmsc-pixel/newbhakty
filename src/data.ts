import { VideoBlock, PricingTier } from "./types";

export const PORTFOLIO_VIDEOS: VideoBlock[] = [
  {
    id: "gold-alchemy",
    title: "Ethereal Alchemy",
    category: "AI Commercial / Fluid Dynamics",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-organic-liquid-gold-floating-fluid-bubbles-48283-large.mp4",
    highResVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-organic-liquid-gold-floating-fluid-bubbles-48283-large.mp4",
    description: "An AI-guided exploration of digital gold cohesion and surface tension simulation, engineered for a luxury haute couture brand's digital storefront.",
    creator: "bhakty.synth-08",
    duration: "0:15",
    ratio: "landscape",
    aspectRatioClass: "aspect-video md:col-span-2",
    tags: ["Fluid Simulation", "Neural Render", "Luxury"],
    page: "ai"
  },
  {
    id: "cosmic-nebula",
    title: "Hyper-Drive Synthetics",
    category: "Sci-Fi Cinematic / Opening Title",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-nebula-in-outer-space-background-34288-large.mp4",
    highResVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-nebula-in-outer-space-background-34288-large.mp4",
    description: "A generative cosmic voyage through starfields made with neural differential equations. Perfect looping backdrop representing infinite depth.",
    creator: "bhakty.core",
    duration: "0:20",
    ratio: "landscape",
    aspectRatioClass: "aspect-square md:col-span-1",
    tags: ["Cosmology", "Stable Diffusion XL", "CineScale"],
    page: "ai"
  },
  {
    id: "algorithmic-currents",
    title: "Quantum Flow Fields",
    category: "Creative Music Video / Motion Art",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4",
    highResVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4",
    description: "Millions of sound-reactive golden particles calculated using custom vector flow fields, rendering live AI-driven responses to progressive sub-bass frequencies.",
    creator: "bhakty.audio-reactive",
    duration: "0:12",
    ratio: "landscape",
    aspectRatioClass: "aspect-square md:col-span-1",
    tags: ["Audio-Reactive", "C4D Cinema", "Deep-Noise"],
    page: "ai"
  },
  {
    id: "neuro-chroma",
    title: "Neuro-Chroma City",
    category: "Speculative Film / Concept Stage",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-neon-city-street-with-cars-and-rain-41221-large.mp4",
    highResVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-neon-city-street-with-cars-and-rain-41221-large.mp4",
    description: "A neo-noir rainfall over virtual metropolis, using generative temporal consistency seeds. Shows rain-refractive physics on wet virtual asphalt.",
    creator: "bhakty.temporal",
    duration: "0:18",
    ratio: "landscape",
    aspectRatioClass: "aspect-video md:col-span-2",
    tags: ["Sora Prototype", "Ray-Tracing", "Cyberpunk"],
    page: "ai"
  },
  {
    id: "vector-horizon",
    title: "Vector Horizon State",
    category: "Live Stage Production / Laser Visuals",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-31718-large.mp4",
    highResVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-31718-large.mp4",
    description: "Multidimensional vector coordinate lasers folding over virtual theatrical surfaces. Synthesized dynamically using localized projection AI algorithms.",
    creator: "bhakty.projection",
    duration: "0:16",
    ratio: "landscape",
    aspectRatioClass: "aspect-square md:col-span-1",
    tags: ["Projection Mapping", "Vector Synth", "Luminous"],
    page: "ai"
  },
  {
    id: "chronocentric-core",
    title: "Chrono-Fluid Pulse",
    category: "Premium Identity / Brand Splash",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4",
    highResVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4",
    description: "An organic glassified neon core swelling rhythmically. Engineered with physical jelly dynamics to match bhakty's visual branding aesthetic.",
    creator: "bhakty.identity",
    duration: "0:15",
    ratio: "landscape",
    aspectRatioClass: "aspect-square md:col-span-1",
    tags: ["Organic Physics", "4K Video Loop", "Jelly Core"],
    page: "ai"
  }
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "short-form",
    name: "Short-Form Creative",
    tagline: "High-octane viral AI media tailored for ultimate digital retention.",
    price: "$2,450",
    period: "month",
    popular: false,
    deliverables: [
      "10x AI-generated Short Reels/TikToks",
      "Dynamic auto-captions & sound-design",
      "High temporal consistency rendering",
      "Aspect ratios: 9:16 vertical & 1:1 square",
      "Source prompt setups & custom style-weights"
    ],
    turnaround: "5 working days",
    revisionRound: "2 Rounds",
    glowTheme: "emerald",
    page: "ai"
  },
  {
    id: "cinematic",
    name: "Full Cinematic Studio",
    tagline: "The complete cinematic suite for commercials, trailers & visual epics.",
    price: "$5,800",
    period: "project",
    popular: true,
    deliverables: [
      "1x High-fidelity 60-90s cinematic trailer",
      "AI vector upscaling (Up to 8K resolution)",
      "Premium custom audio score & SFX alignment",
      "Concept art storyboards & vocal synthesizers",
      "Full digital rights and 4K delivery layers",
      "Interactive feedback workspace access"
    ],
    turnaround: "12 working days",
    revisionRound: "4 Rounds",
    glowTheme: "saffron",
    page: "ai"
  },
  {
    id: "enterprise",
    name: "Enterprise Pipeline",
    tagline: "Bespoke fine-tuned AI diffusion models and full custom pipeline setup.",
    price: "$14,500",
    period: "setup",
    popular: false,
    deliverables: [
      "1x Custom style LoRA trained on brand assets",
      "Up to 3 minutes of dedicated 4K cinematic footage",
      "Dedicated creative visual supervisor",
      "Bespoke audio composer & voice-clone profiles",
      "VRAM hardware pipeline optimization advice",
      "Priority project renders & instant pipeline access"
    ],
    turnaround: "24 working days",
    revisionRound: "Unlimited Revisions",
    glowTheme: "violet",
    page: "ai"
  }
];
