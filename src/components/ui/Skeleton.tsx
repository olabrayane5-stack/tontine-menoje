interface SkeletonProps {
  className?: string;
}

/** Bloc de chargement (skeleton), jamais de spinner. */
export const Skeleton = ({ className = 'h-4 w-full' }: SkeletonProps) => (
  <span className={`skeleton block ${className}`} aria-hidden="true" />
);

/** Carte squelette prête à l'emploi pour les écrans de chargement. */
export const SkeletonCard = () => (
  <div className="app-card space-y-3 p-5" aria-hidden="true">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-7 w-40" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-2/3" />
  </div>
);
