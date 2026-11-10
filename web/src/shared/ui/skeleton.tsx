import { cn } from 'cn';

function Skeleton({ className, ...properties }: Readonly<React.ComponentProps<'div'>>) {
  return <div data-slot="skeleton" className={cn('animate-pulse rounded-md bg-muted', className)} {...properties} />;
}

export { Skeleton };
