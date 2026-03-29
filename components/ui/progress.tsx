import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number, indicatorClass?: string, textClass?: string, label?: string }
>(({ className, value = 0, indicatorClass, textClass, label, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-10 w-full bg-white/5 rounded-xl overflow-hidden flex items-center px-4 hover:bg-white/10 transition-colors",
      className
    )}
    {...props}
  >
    <div
      className={cn("absolute inset-y-0 left-0 transition-all", indicatorClass)}
      style={{ width: `${value}%` }}
    />
    <div className="relative z-10 flex justify-between w-full text-sm font-medium">
       <span className={cn(textClass)}>{label}</span>
       <span className="text-white">{Math.round(value)}%</span>
    </div>
  </div>
))
Progress.displayName = "Progress"

export { Progress }
