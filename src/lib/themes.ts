export interface ThemeDefinition {
  id: string;
  name: string;
  type: "dark" | "light";
  style: {
    bodyBg: string;             // Body background and basic layout spacing
    textPrimary: string;        // Hero and main typography
    textSecondary: string;      // Captions, subtle text
    accentColor: string;        // Text highlights and link status
    accentBg: string;           // Buttons and fill triggers
    accentBorder: string;       // Active borders
    glassBg: string;            // Standard glass backdrop panels
    glassBorder: string;        // Inner glass thin bevel
    cardBg: string;             // Cards background (pricing options, submissions, portfolio titles)
    glowGrad: string;           // Mesh radial aura
    accentLine: string;         // Embellish highlights for panels
    badgeStyle: string;         // Tag outline classes
  };
}

export const WEB_THEMES: ThemeDefinition[] = [
  {
    id: "obsidian_cyber",
    name: "Crimson Obsidian (Default Dark)",
    type: "dark",
    style: {
      bodyBg: "bg-[#050508] text-gray-200",
      textPrimary: "text-white",
      textSecondary: "text-gray-400",
      accentColor: "text-[#e60027]",
      accentBg: "bg-[#e60027] text-white",
      accentBorder: "border-[#e60027]",
      glassBg: "bg-white/[0.02] backdrop-blur-2xl",
      glassBorder: "border-white/10",
      cardBg: "bg-[#0c0808]",
      glowGrad: "from-[#e60027]/25 via-transparent to-[#e60027]/5",
      accentLine: "bg-[#e60027]",
      badgeStyle: "text-[#e60027] bg-[#e60027]/10 border-[#e60027]/30",
    }
  },
  {
    id: "emerald_forest",
    name: "Scarlet Shadow (Deep Cherry)",
    type: "dark",
    style: {
      bodyBg: "bg-[#080202] text-red-100",
      textPrimary: "text-red-50",
      textSecondary: "text-red-500/80",
      accentColor: "text-[#ff1236]",
      accentBg: "bg-[#ff1236] text-black",
      accentBorder: "border-[#ff1236]",
      glassBg: "bg-red-950/20 backdrop-blur-2xl",
      glassBorder: "border-red-500/10",
      cardBg: "bg-[#140507]",
      glowGrad: "from-[#ff1236]/20 via-transparent to-[#ff1236]/5",
      accentLine: "bg-[#ff1236]",
      badgeStyle: "text-[#ff1236] bg-[#ff1236]/10 border-[#ff1236]/30",
    }
  },
  {
    id: "sunset_vapor",
    name: "Blood Moon (Warm Crimson)",
    type: "dark",
    style: {
      bodyBg: "bg-[#0a0404] text-red-200",
      textPrimary: "text-white",
      textSecondary: "text-red-400",
      accentColor: "text-[#ff3b30]",
      accentBg: "bg-[#ff3b30] text-white",
      accentBorder: "border-[#ff3b30]",
      glassBg: "bg-red-950/15 backdrop-blur-2xl",
      glassBorder: "border-red-500/15",
      cardBg: "bg-[#18090a]",
      glowGrad: "from-[#ff3b30]/20 via-transparent to-[#ff3b30]/5",
      accentLine: "bg-[#ff3b30]",
      badgeStyle: "text-[#ff3b30] bg-[#ff3b30]/10 border-[#ff3b30]/30",
    }
  },
  {
    id: "royal_indigo",
    name: "Red Horizon (Cosmic Charcoal)",
    type: "dark",
    style: {
      bodyBg: "bg-[#030305] text-gray-300",
      textPrimary: "text-white",
      textSecondary: "text-gray-500",
      accentColor: "text-[#d6001c]",
      accentBg: "bg-[#d6001c] text-white",
      accentBorder: "border-[#d6001c]",
      glassBg: "bg-red-950/10 backdrop-blur-2xl",
      glassBorder: "border-red-500/10",
      cardBg: "bg-[#0c0809]",
      glowGrad: "from-[#d6001c]/20 via-transparent to-[#d6001c]/5",
      accentLine: "bg-[#d6001c]",
      badgeStyle: "text-[#d6001c] bg-[#d6001c]/10 border-[#d6001c]/30",
    }
  },
  {
    id: "nordic_frost",
    name: "Stark Carbon (Slate Red)",
    type: "dark",
    style: {
      bodyBg: "bg-[#0a0a0c] text-slate-300",
      textPrimary: "text-white",
      textSecondary: "text-slate-500",
      accentColor: "text-[#ff2a55]",
      accentBg: "bg-[#ff2a55] text-white",
      accentBorder: "border-[#ff2a55]",
      glassBg: "bg-slate-950/40 backdrop-blur-2xl",
      glassBorder: "border-slate-800/30",
      cardBg: "bg-[#121216]",
      glowGrad: "from-[#ff2a55]/15 via-transparent to-[#ff2a55]/5",
      accentLine: "bg-[#ff2a55]",
      badgeStyle: "text-[#ff2a55] bg-[#ff2a55]/10 border-[#ff2a55]/30",
    }
  },
  {
    id: "stark_monochrome_dark",
    name: "Stark Crimson (Monochrome Red)",
    type: "dark",
    style: {
      bodyBg: "bg-[#000000] text-gray-400",
      textPrimary: "text-white",
      textSecondary: "text-neutral-600",
      accentColor: "text-[#e60027] underline decoration-red-500/50",
      accentBg: "bg-[#e60027] text-white",
      accentBorder: "border-[#e60027]",
      glassBg: "bg-zinc-950/40 backdrop-blur-2xl",
      glassBorder: "border-zinc-900/60",
      cardBg: "bg-[#080808]",
      glowGrad: "from-[#e60027]/15 via-transparent to-transparent",
      accentLine: "bg-[#e60027]",
      badgeStyle: "text-[#e60027] bg-[#e60027]/10 border-[#e60027]/20",
    }
  },
  {
    id: "alabaster_luxury",
    name: "Alabaster Luxury (Premium Light)",
    type: "light",
    style: {
      bodyBg: "bg-[#faf9f6] text-zinc-700",
      textPrimary: "text-zinc-950",
      textSecondary: "text-zinc-500",
      accentColor: "text-indigo-600",
      accentBg: "bg-indigo-600 text-white",
      accentBorder: "border-indigo-600",
      glassBg: "bg-white/40 backdrop-blur-xl shadow-md",
      glassBorder: "border-zinc-300/30",
      cardBg: "bg-white",
      glowGrad: "from-indigo-600/5 via-transparent to-[#E6C687]/5",
      accentLine: "bg-indigo-600",
      badgeStyle: "text-indigo-600 bg-indigo-50 border-indigo-200",
    }
  },
  {
    id: "rose_gold_light",
    name: "Rose Quartz (Warm Light Glow)",
    type: "light",
    style: {
      bodyBg: "bg-[#FFF9F9] text-zinc-700",
      textPrimary: "text-zinc-900",
      textSecondary: "text-rose-600/60",
      accentColor: "text-rose-600",
      accentBg: "bg-rose-500 text-white",
      accentBorder: "border-rose-500",
      glassBg: "bg-white/50 backdrop-blur-xl shadow-md",
      glassBorder: "border-rose-200/40",
      cardBg: "bg-white",
      glowGrad: "from-rose-400/5 via-transparent to-amber-300/5",
      accentLine: "bg-rose-500",
      badgeStyle: "text-rose-600 bg-rose-50 border-rose-200",
    }
  },
  {
    id: "champagne_light",
    name: "Champagne Ivory (Golden Light)",
    type: "light",
    style: {
      bodyBg: "bg-[#FDFBF7] text-zinc-700",
      textPrimary: "text-zinc-900",
      textSecondary: "text-amber-700/60",
      accentColor: "text-amber-800",
      accentBg: "bg-amber-900/90 text-white",
      accentBorder: "border-amber-900/90",
      glassBg: "bg-white/50 backdrop-blur-xl shadow-md",
      glassBorder: "border-amber-200/40",
      cardBg: "bg-white",
      glowGrad: "from-amber-400/5 via-transparent to-[#E6C687]/5",
      accentLine: "bg-amber-800",
      badgeStyle: "text-amber-800 bg-amber-50 border-amber-200",
    }
  },
  {
    id: "stark_monochrome_light",
    name: "Stark Monochrome (Light)",
    type: "light",
    style: {
      bodyBg: "bg-[#ffffff] text-zinc-650",
      textPrimary: "text-black",
      textSecondary: "text-zinc-400",
      accentColor: "text-black underline",
      accentBg: "bg-black text-white",
      accentBorder: "border-black",
      glassBg: "bg-zinc-100/50 backdrop-blur-xl shadow-sm",
      glassBorder: "border-zinc-300/60",
      cardBg: "bg-zinc-50",
      glowGrad: "from-neutral-200/10 via-transparent to-neutral-200/5",
      accentLine: "bg-black",
      badgeStyle: "text-black bg-neutral-100 border-neutral-300",
    }
  }
];

export const getActiveTheme = (themeId?: string): ThemeDefinition => {
  return WEB_THEMES.find(t => t.id === themeId) || WEB_THEMES[0];
};
