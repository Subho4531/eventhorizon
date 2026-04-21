import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number, indicatorClass?: string, textClass?: string, label?: string }
>(({ className, value = 0, indicatorClass, textClass, label, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-8 w-full bg-black/40 border border-white/5 rounded-sm overflow-hidden flex items-center px-3 font-mono",
      className
    )}
    {...props}
  >
    <div
      className={cn("absolute inset-y-0 left-0 transition-all duration-500", indicatorClass)}
      style={{ width: `${value}%` }}
    />
    {/* Grid Overlay for utility look */}
    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.1)_95%)] bg-[length:10%_100%]" />
    
    <div className="relative z-10 flex justify-between w-full text-[10px] font-bold tracking-tighter">
       <span className={cn(textClass, "uppercase")}>{label}</span>
       <span className="text-white/80">{Math.round(value)}%</span>
    </div>
  </div>
))
Progress.displayName = "Progress"

export { Progress }
