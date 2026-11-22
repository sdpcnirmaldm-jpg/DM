import React, { useState } from 'react';
import { Check, Copy, Download, FileText } from 'lucide-react';

interface MarkdownClinicalReportProps {
  content: string;
  title?: string;
  subtitle?: string;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#053B2B]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-[#EFF5F1] text-[#053B2B] font-mono text-[12px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

type BlockNode =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(raw: string): BlockNode[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }

    // Markdown table block
    if (
      line.startsWith('|') &&
      i + 1 < lines.length &&
      /^\|?[\s:-]+\|/.test(lines[i + 1].trim())
    ) {
      const parseCells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseCells(line);
      i += 2; // skip header & divider
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseCells(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Headings (#, ##, ###)
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: headingMatch[2].replace(/\*\*/g, '') });
      i += 1;
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph (combine adjacent plain lines)
    const paraLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('|')
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
  }

  return blocks;
}

export const MarkdownClinicalReport: React.FC<MarkdownClinicalReportProps> = ({
  content,
  title = 'Clinical Analysis Brief',
  subtitle,
}) => {
  const [copied, setCopied] = useState(false);

  const blocks = parseMarkdownBlocks(content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in restricted browser contexts; silently ignore
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `clinical-analysis-${dateStamp}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-[#DDE8E2] rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 bg-[#F6F9F7] border-b border-[#DDE8E2] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-[#047857] shrink-0" />
          <div className="min-w-0">
            <h4 className="font-display text-sm font-bold text-[#14201B] truncate">{title}</h4>
            {subtitle && (
              <p className="text-[11px] text-[#4B6157] truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-xs font-medium text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#047857]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#4B6157]" />
                <span>Copy Report</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-xs font-medium text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#4B6157]" />
            <span>Export .md</span>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-3.5 text-sm text-[#14201B] leading-relaxed max-h-[620px] overflow-y-auto">
        {blocks.map((block, idx) => {
          if (block.type === 'heading') {
            if (block.level === 1) {
              return (
                <h3
                  key={idx}
                  className="font-display text-base font-bold text-[#053B2B] pt-2 first:pt-0 border-b border-[#EEF3F0] pb-1.5"
                >
                  {block.text}
                </h3>
              );
            }
            if (block.level === 2) {
              return (
                <h4
                  key={idx}
                  className="font-display text-[15px] font-bold text-[#053B2B] pt-2 first:pt-0"
                >
                  {block.text}
                </h4>
              );
            }
            return (
              <h5
                key={idx}
                className="text-xs font-bold uppercase tracking-wider text-[#047857] pt-1.5 first:pt-0"
              >
                {block.text}
              </h5>
            );
          }

          if (block.type === 'ul') {
            return (
              <ul key={idx} className="space-y-1.5 pl-4 list-disc marker:text-[#047857]">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="text-[13.5px] leading-relaxed">
                    {renderInlineFormatting(item)}
                  </li>
                ))}
              </ul>
            );
          }

          if (block.type === 'ol') {
            return (
              <ol key={idx} className="space-y-1.5 pl-5 list-decimal marker:text-[#047857] marker:font-semibold">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="text-[13.5px] leading-relaxed">
                    {renderInlineFormatting(item)}
                  </li>
                ))}
              </ol>
            );
          }

          if (block.type === 'table') {
            return (
              <div key={idx} className="overflow-x-auto border border-[#DDE8E2] rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-[#F6F9F7] border-b border-[#DDE8E2]">
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3 py-2 font-semibold text-[#053B2B]">
                          {renderInlineFormatting(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F0]">
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#FAFDFB]">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-[#14201B] tabular-nums">
                            {renderInlineFormatting(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          return (
            <p key={idx} className="text-[13.5px] text-[#14201B] leading-relaxed">
              {renderInlineFormatting(block.text)}
            </p>
          );
        })}
      </div>
    </div>
  );
};
