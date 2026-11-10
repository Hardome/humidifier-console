import type { ComponentProps } from 'react';

import { cn } from 'cn';
import { ChevronDown } from 'lucide-react';

export function NativeSelect({ className, ...properties }: Readonly<ComponentProps<'select'>>) {
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <select
        {...properties}
        className="min-h-[38px] w-full cursor-pointer appearance-none rounded-control border border-border bg-card py-[9px] pr-10 pl-3 text-foreground disabled:cursor-default"
      />
      <ChevronDown
        aria-hidden="true"
        data-slot="select-icon"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
