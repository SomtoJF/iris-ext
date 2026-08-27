import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={copied ? "Copied" : "Copy"}
      onClick={handleCopy}
      className={cn("w-fit px-1.5 text-xs", className)}
    >
      <Copy className="size-3.5" />
      {copied && "Copied!"}
    </Button>
  );
}
