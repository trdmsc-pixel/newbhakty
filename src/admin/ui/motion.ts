/**
 * The Chanting Studio — Admin Motion System
 * Clean, consistent sliding fades and spring physics.
 */

export const ease = [0.16, 1, 0.3, 1] as const;          // reveals, slides
export const easeInOut = [0.65, 0, 0.35, 1] as const;    // height, draws

export const pillSpring = {
  type: "spring",
  stiffness: 420,
  damping: 34,
} as const;

// Tab-to-tab: direction-aware slide + fade + slight blur
export const tabTransition = (dir: 1 | -1) => ({
  initial: { opacity: 0, x: 28 * dir, filter: "blur(6px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.45, ease } },
  exit:    { opacity: 0, x: -20 * dir, filter: "blur(4px)", transition: { duration: 0.22, ease: easeInOut } },
});

// Staggered container and child variants
export const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.06,
    },
  },
};

export const rise = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

// Modal and drawer animations
export const dialogFade = {
  initial: { opacity: 0, scale: 0.97, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.32, ease } },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.2, ease: easeInOut } },
};

export const drawerSlide = {
  initial: { x: "100%" },
  animate: { x: 0, transition: { duration: 0.4, ease } },
  exit: { x: "100%", transition: { duration: 0.25, ease: easeInOut } },
};
