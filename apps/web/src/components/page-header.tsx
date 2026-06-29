import type { ReactNode } from "react";

// Shared signed-in page header. The handwritten Caveat eyebrow is the café
// "chalkboard menu" signature that ties the back-of-house admin views to the
// public Barista Blend identity. Title uses the heading face; an optional action
// (button, form trigger) docks to the right and collapses below on mobile.
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-caveat text-2xl font-bold leading-none text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
