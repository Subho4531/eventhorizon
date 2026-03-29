import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "glass-pill px-3 py-1 text-[10px] uppercase tracking-wider text-blue-400 font-medium flex items-center gap-1.5 rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
