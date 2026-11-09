import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
  as?: 'div' | 'ul' | 'section';
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}

/**
 * Apparition en cascade d'une liste de cartes ou de lignes.
 * Les animations ne touchent que `opacity` et `transform`.
 */
export const Stagger = ({ children, className, delay = 0, gap = 0.06, as = 'div' }: StaggerProps) => {
  const reduceMotion = useReducedMotion();

  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : gap,
        delayChildren: delay,
      },
    },
  };

  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
    >
      {children}
    </MotionTag>
  );
};

export const StaggerItem = ({ children, className, as = 'div' }: StaggerItemProps) => {
  const reduceMotion = useReducedMotion();

  const variants: Variants = {
    hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
    },
  };

  const MotionTag = motion[as];

  return (
    <MotionTag className={className} variants={variants}>
      {children}
    </MotionTag>
  );
};
