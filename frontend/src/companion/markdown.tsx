/**
 * Tiny, safe markdown-lite renderer for companion messages.
 * Supports: **bold**, *italic*, `inline code`, fenced ``` blocks, bullet
 * lists, and paragraphs. Pure React nodes — no dangerouslySetInnerHTML.
 */
import React from 'react';

const renderInline = (text: string, keyBase: string): React.ReactNode[] => {
  // Split on bold / italic / code spans, keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
};

export const MarkdownLite: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  // Fenced code blocks first.
  const segments = text.split(/```(?:\w*\n)?/);

  segments.forEach((segment, si) => {
    if (si % 2 === 1) {
      blocks.push(
        <pre key={`code-${si}`} className="companion-code">
          <code>{segment.replace(/\n$/, '')}</code>
        </pre>,
      );
      return;
    }

    const lines = segment.split('\n');
    let list: string[] = [];
    let para: string[] = [];

    const flushList = (key: string) => {
      if (!list.length) return;
      blocks.push(
        <ul key={key}>
          {list.map((item, li) => (
            <li key={li}>{renderInline(item, `${key}-${li}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    };

    const flushPara = (key: string) => {
      if (!para.length) return;
      blocks.push(<p key={key}>{renderInline(para.join(' '), key)}</p>);
      para = [];
    };

    lines.forEach((line, li) => {
      const bullet = line.match(/^\s*[-•*]\s+(.*)/);
      if (bullet) {
        flushPara(`p-${si}-${li}`);
        list.push(bullet[1]);
      } else if (line.trim() === '') {
        flushList(`l-${si}-${li}`);
        flushPara(`p-${si}-${li}`);
      } else {
        flushList(`l-${si}-${li}`);
        para.push(line.trim());
      }
    });
    flushList(`l-${si}-end`);
    flushPara(`p-${si}-end`);
  });

  return <div className="companion-md">{blocks}</div>;
};

export default MarkdownLite;
