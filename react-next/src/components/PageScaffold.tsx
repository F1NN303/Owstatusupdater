import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <main className={cn("mx-auto max-w-md px-4 pb-32 pt-8", className)}>{children}</main>;
}

export function PageIntro({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 pb-5 pt-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function GlassSection({
  children,
  className,
  contentClassName,
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  as?: "section" | "div";
}) {
  const Tag = as;

  return (
    <Tag className={cn("glass glass-specular rounded-2xl p-4", className)}>
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </Tag>
  );
}
