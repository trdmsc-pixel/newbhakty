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
    name: "Golden Obsidian (Default Dark)",
    type: "dark",
    style: {
      bodyBg: "bg-[#050508] text-gray-200",
      textPrimary: "text-white",
      textSecondary: "text-gray-400",
      accentColor: "text-[#ffea00]",
      accentBg: "bg-[#ffea00] text-black",
      accentBorder: "border-[#ffea00]",
      glassBg: "bg-white/[0.02] backdrop-blur-2xl",
      glassBorder: "border-white/10",
      cardBg: "bg-[#0c0c08]",
      glowGrad: "from-[#ffea00]/25 via-transparent to-[#ffea00]/5",
      accentLine: "bg-[#ffea00]",
      badgeStyle: "text-[#ffea00] bg-[#ffea00]/10 border-[#ffea00]/30",
    }
  },
  {
    id: "emerald_forest",
    name: "Amber Aura (Deep Gold)",
    type: "dark",
    style: {
      bodyBg: "bg-[#080702] text-amber-100",
      textPrimary: "text-amber-50",
      textSecondary: "text-amber-500/80",
      accentColor: "text-[#ffdf00]",
      accentBg: "bg-[#ffdf00] text-black",
      accentBorder: "border-[#ffdf00]",
      glassBg: "bg-amber-950/20 backdrop-blur-2xl",
      glassBorder: "border-amber-500/10",
      cardBg: "bg-[#141205]",
      glowGrad: "from-[#ffdf00]/20 via-transparent to-[#ffdf00]/5",
      accentLine: "bg-[#ffdf00]",
      badgeStyle: "text-[#ffdf00] bg-[#ffdf00]/10 border-[#ffdf00]/30",
    }
  },
  {
    id: "sunset_vapor",
    name: "Solar Flare (Warm Gold)",
    type: "dark",
    style: {
      bodyBg: "bg-[#0a0904] text-yellow-200",
      textPrimary: "text-white",
      textSecondary: "text-yellow-400",
      accentColor: "text-[#ffd600]",
      accentBg: "bg-[#ffd600] text-black",
      accentBorder: "border-[#ffd600]",
      glassBg: "bg-yellow-950/15 backdrop-blur-2xl",
      glassBorder: "border-yellow-500/15",
      cardBg: "bg-[#181509]",
      glowGrad: "from-[#ffd600]/20 via-transparent to-[#ffd600]/5",
      accentLine: "bg-[#ffd600]",
      badgeStyle: "text-[#ffd600] bg-[#ffd600]/10 border-[#ffd600]/30",
    }
  },
  {
    id: "royal_indigo",
    name: "Gold Horizon (Cosmic Charcoal)",
    type: "dark",
    style: {
      bodyBg: "bg-[#030305] text-gray-300",
      textPrimary: "text-white",
      textSecondary: "text-gray-500",
      accentColor: "text-[#ffcc00]",
      accentBg: "bg-[#ffcc00] text-black",
      accentBorder: "border-[#ffcc00]",
      glassBg: "bg-yellow-950/10 backdrop-blur-2xl",
      glassBorder: "border-yellow-500/10",
      cardBg: "bg-[#0c0b08]",
      glowGrad: "from-[#ffcc00]/20 via-transparent to-[#ffcc00]/5",
      accentLine: "bg-[#ffcc00]",
      badgeStyle: "text-[#ffcc00] bg-[#ffcc00]/10 border-[#ffcc00]/30",
    }
  },
  {
    id: "nordic_frost",
    name: "Stark Carbon (Slate Gold)",
    type: "dark",
    style: {
      bodyBg: "bg-[#0a0a0c] text-slate-300",
      textPrimary: "text-white",
      textSecondary: "text-slate-500",
      accentColor: "text-[#ffdf00]",
      accentBg: "bg-[#ffdf00] text-black",
      accentBorder: "border-[#ffdf00]",
      glassBg: "bg-slate-950/40 backdrop-blur-2xl",
      glassBorder: "border-slate-800/30",
      cardBg: "bg-[#12120e]",
      glowGrad: "from-[#ffdf00]/15 via-transparent to-[#ffdf00]/5",
      accentLine: "bg-[#ffdf00]",
      badgeStyle: "text-[#ffdf00] bg-[#ffdf00]/10 border-[#ffdf00]/30",
    }
  },
  {
    id: "stark_monochrome_dark",
    name: "Stark Golden (Monochrome Gold)",
    type: "dark",
    style: {
      bodyBg: "bg-[#000000] text-gray-400",
      textPrimary: "text-white",
      textSecondary: "text-neutral-600",
      accentColor: "text-[#ffea00] underline decoration-yellow-500/50",
      accentBg: "bg-[#ffea00] text-black",
      accentBorder: "border-[#ffea00]",
      glassBg: "bg-zinc-950/40 backdrop-blur-2xl",
      glassBorder: "border-zinc-900/60",
      cardBg: "bg-[#080806]",
      glowGrad: "from-[#ffea00]/15 via-transparent to-transparent",
      accentLine: "bg-[#ffea00]",
      badgeStyle: "text-[#ffea00] bg-[#ffea00]/10 border-[#ffea00]/20",
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
