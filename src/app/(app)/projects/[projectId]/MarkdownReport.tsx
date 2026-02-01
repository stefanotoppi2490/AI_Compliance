import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownReport({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-zinc max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-extrabold text-zinc-900 mb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-2 text-lg font-bold text-zinc-800">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 text-md font-bold text-zinc-800">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="text-sm text-zinc-700 leading-relaxed">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-900">{children}</strong>
          ),
          p: ({ children }) => (
            <p className="text-sm text-zinc-700 leading-relaxed mb-2">
              {children}
            </p>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
