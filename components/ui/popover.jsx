"use client"

import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

function Popover(props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ className, ...props }) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      className={cn("outline-none", className)}
      {...props} />
  );
}

function PopoverContent({ className, align = "center", sideOffset = 8, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        side="bottom"
        sideOffset={sideOffset}
        className="z-50 outline-none">
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "w-auto rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none",
            className
          )}
          {...props} />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent }
