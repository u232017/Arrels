import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** shadcn/ui-style Card: radius 12, 1 px border, no heavy shadow. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={cn("rounded-card border border-line bg-white p-4", className)} {...props} />;
}
