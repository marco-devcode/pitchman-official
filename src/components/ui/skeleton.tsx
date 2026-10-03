import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted dark:bg-brand-green/5 border border-border dark:border-brand-green/20 shadow-sm dark:shadow-theme", className)}
      {...props}
    />
  )
}

export { Skeleton }
