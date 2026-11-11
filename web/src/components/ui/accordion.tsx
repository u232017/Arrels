import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/** shadcn/ui-style Accordion with one collapsible item. Collapsed by default. */
export function AccordionSection({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <AccordionPrimitive.Root type="single" collapsible className="rounded-card border border-line bg-white">
      <AccordionPrimitive.Item value={value}>
        <AccordionPrimitive.Header asChild>
          <h2 className="m-0">
            <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between rounded-card px-4 py-3 text-left text-section font-semibold text-navy hover:bg-surface">
              {title}
              <ChevronDown aria-hidden="true" className="size-5 text-text-2 transition-transform group-data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>
          </h2>
        </AccordionPrimitive.Header>
        <AccordionPrimitive.Content className="px-4 pb-4 text-body text-navy">{children}</AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}
