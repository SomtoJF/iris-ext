"use client";

import { Copy } from "lucide-react";
import Markdown from "react-markdown";
import { Button } from "./ui/button";

interface Props {
  markdown: string;
}

export function JobDescription({ markdown }: Props) {
  const [showCopied, setShowCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
  };

  useEffect(() => {
    if (showCopied) {
      setTimeout(() => {
        setShowCopied(false);
      }, 1500);
    }
  }, [showCopied]);

  return (
    <div className="mx-auto max-h-64 overflow-y-auto border border-gray-200 p-4">
      <h2 className="mb-2 text-xs font-bold uppercase text-gray-800">
        Job Description
      </h2>
      <div className="text-xs leading-relaxed text-gray-700">
        <Markdown
          components={{
            h1: ({ children }) => (
              <h3 className="mt-3 mb-1 text-sm font-semibold text-gray-900 first:mt-0">
                {children}
              </h3>
            ),
            h2: ({ children }) => (
              <h3 className="mt-3 mb-1 text-sm font-semibold text-gray-900 first:mt-0">
                {children}
              </h3>
            ),
            h3: ({ children }) => (
              <h4 className="mt-2 mb-1 text-xs font-semibold text-gray-900 first:mt-0">
                {children}
              </h4>
            ),
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => (
              <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">
                {children}
              </ol>
            ),
            li: ({ children }) => <li>{children}</li>,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-violet-700 underline hover:text-violet-800"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-900">
                {children}
              </strong>
            ),
            code: ({ children }) => (
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px]">
                {children}
              </code>
            ),
          }}
        >
          {markdown}
        </Markdown>
        <div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              handleCopy();
              setShowCopied(true);
            }}
            variant="outline"
            className="w-fit px-1.5 text-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            {showCopied && "Copied!"}
          </Button>
        </div>
      </div>
    </div>
  );
}
