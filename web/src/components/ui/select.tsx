import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

/** shadcn/ui-style labelled Select (Radix). The visible label is linked to the trigger. */
export function LabelledSelect({ label, value, options, onChange, className }: Props) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-caption font-medium text-text-2">{label}</label>
      <SelectPrimitive.Root value={value} onValueChange={onChange}>
        <SelectPrimitive.Trigger
          id={id}
          className="flex h-10 w-full min-w-40 items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 text-body text-navy hover:border-teal"
        >
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon><ChevronDown aria-hidden="true" className="size-4 text-text-2" /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content position="popper" sideOffset={4}
            className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-white shadow-sm">
            <SelectPrimitive.Viewport className="p-1">
              {options.map((o) => (
                <SelectPrimitive.Item key={o.value} value={o.value}
                  className="relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-body text-navy outline-none data-[highlighted]:bg-surface">
                  <SelectPrimitive.ItemIndicator className="absolute left-2"><Check aria-hidden="true" className="size-4 text-teal-dark" /></SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
