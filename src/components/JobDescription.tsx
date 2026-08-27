import Markdown from "react-markdown";
import { DocumentPanel } from "@/components/DocumentPanel";

interface Props {
  markdown: string;
}

export function JobDescription({ markdown }: Props) {
  return (
    <DocumentPanel title="Job Description" copyText={markdown}>
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
            <strong className="font-semibold text-gray-900">{children}</strong>
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
    </DocumentPanel>
  );
}
