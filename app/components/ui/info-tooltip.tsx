import { useState } from "react";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "./utils";

interface InfoTooltipProps {
  content: string;
  ariaLabel: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function InfoTooltip({
  content,
  ariaLabel,
  side = "top",
  className,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip delayDuration={250} open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-64 leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}