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
    name: "Obsidian Cyber (Default Dark)",
    type: "dark",
    style: {
      bodyBg: "bg-[#050508] text-gray-200",
      textPrimary: "text-white",
      textSecondary: "text-gray-400",
      accentColor: "text-[#E6C687]",
      accentBg: "bg-[#E6C687] text-black",
      accentBorder: "border-[#E6C687]",
      glassBg: "bg-white/[0.03] backdrop-blur-2xl",
      glassBorder: "border-white/10",
      cardBg: "bg-[#11111c]",
      glowGrad: "from-[#4A36B3]/30 via-transparent to-[#E6C687]/20",
      accentLine: "bg-[#E6C687]",
      badgeStyle: "text-[#E6C687] bg-[#E6C687]/10 border-[#E6C687]/30",
    }
  },
  {
    id: "emerald_forest",
    name: "Emerald Forest (Deep Gold)",
    type: "dark",
    style: {
      bodyBg: "bg-[#04140e] text-emerald-100",
      textPrimary: "text-emerald-50",
      textSecondary: "text-emerald-500/80",
      accentColor: "text-[#D4AF37]",
      accentBg: "bg-[#D4AF37] text-emerald-950",
      accentBorder: "border-[#D4AF37]",
      glassBg: "bg-emerald-950/25 backdrop-blur-2xl",
      glassBorder: "border-emerald-500/10",
      cardBg: "bg-[#062016]",
      glowGrad: "from-[#0d5236]/30 via-transparent to-[#D4AF37]/25",
      accentLine: "bg-[#D4AF37]",
      badgeStyle: "text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30",
    }
  },
  {
    id: "sunset_vapor",
    name: "Sunset Vapor (Warm Cyber)",
    type: "dark",
    style: {
      bodyBg: "bg-[#0d0714] text-pink-100",
      textPrimary: "text-pink-100",
      textSecondary: "text-purple-400",
      accentColor: "text-orange-400",
      accentBg: "bg-orange-500 text-black",
      accentBorder: "border-orange-500",
      glassBg: "bg-purple-950/15 backdrop-blur-2xl",
      glassBorder: "border-purple-500/15",
      cardBg: "bg-[#180e22]",
      glowGrad: "from-pink-500/20 via-transparent to-orange-500/20",
      accentLine: "bg-orange-400",
      badgeStyle: "text-orange-400 bg-orange-400/10 border-orange-400/30",
    }
  },
  {
    id: "royal_indigo",
    name: "Royal Indigo (Cosmic Blue)",
    type: "dark",
    style: {
      bodyBg: "bg-[#030616] text-blue-100",
      textPrimary: "text-white",
      textSecondary: "text-blue-300/70",
      accentColor: "text-indigo-400",
      accentBg: "bg-indigo-500 text-white",
      accentBorder: "border-indigo-500",
      glassBg: "bg-indigo-950/20 backdrop-blur-2xl",
      glassBorder: "border-indigo-500/10",
      cardBg: "bg-[#070c27]",
      glowGrad: "from-indigo-600/30 via-transparent to-blue-400/20",
      accentLine: "bg-indigo-400",
      badgeStyle: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
    }
  },
  {
    id: "nordic_frost",
    name: "Nordic Frost (Sleek Slate)",
    type: "dark",
    style: {
      bodyBg: "bg-[#0d1117] text-slate-300",
      textPrimary: "text-white",
      textSecondary: "text-slate-500",
      accentColor: "text-cyan-400",
      accentBg: "bg-cyan-500 text-black",
      accentBorder: "border-cyan-500",
      glassBg: "bg-slate-900/40 backdrop-blur-2xl",
      glassBorder: "border-slate-700/30",
      cardBg: "bg-[#161b22]",
      glowGrad: "from-blue-600/15 via-transparent to-cyan-400/15",
      accentLine: "bg-cyan-400",
      badgeStyle: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
    }
  },
  {
    id: "stark_monochrome_dark",
    name: "Stark Monochrome (Dark)",
    type: "dark",
    style: {
      bodyBg: "bg-[#000000] text-gray-400",
      textPrimary: "text-white",
      textSecondary: "text-neutral-500",
      accentColor: "text-white underline decoration-zinc-400",
      accentBg: "bg-white text-black",
      accentBorder: "border-white",
      glassBg: "bg-zinc-900/40 backdrop-blur-2xl",
      glassBorder: "border-zinc-800/60",
      cardBg: "bg-[#0e0e0e]",
      glowGrad: "from-neutral-800/20 via-transparent to-neutral-700/10",
      accentLine: "bg-white",
      badgeStyle: "text-white bg-white/10 border-white/20",
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
