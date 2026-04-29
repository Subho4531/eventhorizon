import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number, indicatorClass?: string, textClass?: string, label?: string }
>(({ className, value = 0, indicatorClass, textClass, label, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-8 w-full bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden flex items-center px-3 group/progress transition-all duration-300 hover:bg-white/[0.03] hover:border-white/[0.08]",
      className
    )}
    {...props}
  >
    {/* Animated fill bar */}
    <div
      className={cn(
        "absolute inset-y-0 left-0 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] rounded-lg",
        indicatorClass
      )}
      style={{ width: `${value}%` }}
    />
    
    {/* Shimmer effect on the bar edge */}
    {value > 0 && (
      <div
        className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent to-white/[0.04] rounded-lg opacity-0 group-hover/progress:opacity-100 transition-opacity duration-500"
        style={{ left: `calc(${Math.min(value, 95)}% - 16px)` }}
      />
    )}
    
    <div className="relative z-10 flex justify-between w-full text-[9px] font-bold tracking-wider">
       <span className={cn(textClass, "uppercase")}>{label}</span>
       <span className="text-white/50 tabular-nums font-mono">{Math.round(value)}%</span>
    </div>
  </div>
))
Progress.displayName = "Progress"

export { Progress }
