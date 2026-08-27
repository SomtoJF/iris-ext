import type { ReactNode } from "react";
import { CopyButton } from "@/components/CopyButton";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  copyText: string;
  children: ReactNode;
  className?: string;
}

export function DocumentPanel({ title, copyText, children, className }: Props) {
  return (
    <section className={cn(className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase text-gray-800">{title}</h2>
        <CopyButton text={copyText} />
      </div>
      <div className="text-xs leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}
