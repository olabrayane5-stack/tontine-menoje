import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../utils/tontineUtils';

interface AnimatedAmountProps {
  value: number;
  devise?: string;
  duration?: number;
  className?: string;
}

/**
 * Montant qui s'incrémente de 0 jusqu'à sa valeur (~1,2 s par défaut).
 * L'animation est coupée si l'utilisateur préfère réduire les animations.
 */
export const AnimatedAmount = ({
  value,
  devise = 'FCFA',
  duration = 1.2,
  className,
}: AnimatedAmountProps) => {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(() => (reduceMotion ? value : 0));
  const currentRef = useRef(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    const controls = animate(currentRef.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        currentRef.current = latest;
        setDisplay(latest);
      },
    });

    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return (
    <span className={className} aria-label={formatMoney(value, devise)}>
      <span aria-hidden="true">{formatMoney(display, devise)}</span>
    </span>
  );
};
