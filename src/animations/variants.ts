// ============================================================================
// EcoTrack AI — Framer Motion Animation Variants
// ============================================================================
// Centralized animation definitions. All animations respect
// prefers-reduced-motion via the useReducedMotion hook.
// ============================================================================

import type { Variants, Transition } from 'framer-motion';

// ============================================================================
// Transitions
// ============================================================================

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  duration: 0.4,
  ease: [0.25, 0.46, 0.45, 0.94],
};

export const slowTransition: Transition = {
  duration: 0.6,
  ease: [0.25, 0.46, 0.45, 0.94],
};

// ============================================================================
// Page Transitions
// ============================================================================

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0, transition: smoothTransition },
  exit: { opacity: 0, x: -30, transition: { duration: 0.2 } },
};

export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -60 },
  animate: { opacity: 1, x: 0, transition: smoothTransition },
  exit: { opacity: 0, x: 30, transition: { duration: 0.2 } },
};

export const slideInUp: Variants = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0, transition: smoothTransition },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

// ============================================================================
// Staggered Children
// ============================================================================

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: smoothTransition,
  },
};

export const staggerFadeIn: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
};

// ============================================================================
// Card Animations
// ============================================================================

export const cardHover = {
  scale: 1.02,
  y: -4,
  transition: { duration: 0.2, ease: 'easeOut' },
};

export const cardTap = {
  scale: 0.98,
  transition: { duration: 0.1 },
};

export const cardVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: smoothTransition,
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

// ============================================================================
// Modal Animations
// ============================================================================

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 30 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// Counter / Number Animations
// ============================================================================

export const countUpVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// ============================================================================
// Chart Animations
// ============================================================================

export const chartDrawIn: Variants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.5, ease: 'easeInOut' },
  },
};

// ============================================================================
// Onboarding Step Transitions
// ============================================================================

export const onboardingStepVariants: Variants = {
  initial: { opacity: 0, x: 100, scale: 0.95 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    x: -100,
    scale: 0.95,
    transition: { duration: 0.3 },
  },
};

// ============================================================================
// Celebration Animations
// ============================================================================

export const celebrationVariants: Variants = {
  initial: { scale: 0, rotate: -180 },
  animate: {
    scale: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 200, damping: 15 },
  },
};

export const confettiVariants: Variants = {
  initial: { y: -20, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5 },
  },
};

// ============================================================================
// Pulse & Glow
// ============================================================================

export const pulseAnimation = {
  scale: [1, 1.05, 1],
  transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
};

export const glowAnimation = {
  boxShadow: [
    '0 0 0 0 rgba(14, 165, 160, 0)',
    '0 0 20px 10px rgba(14, 165, 160, 0.3)',
    '0 0 0 0 rgba(14, 165, 160, 0)',
  ],
  transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
};

// ============================================================================
// Reduced Motion Fallback
// ============================================================================

export const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};
