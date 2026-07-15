/**
 * Markdown — the one lightweight, safe markdown renderer for every chat
 * surface (tutor chat, companion, inline notes). Supports: headings, **bold**,
 * *italic*, `inline code`, fenced ``` blocks, bullet and numbered lists, and
 * paragraphs. Pure React nodes — no dangerouslySetInnerHTML.
 */
import React from 'react';
import './shared.css';

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

export const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  // Fenced code blocks first.
  const segments = text.split(/```(?:\w*\n)?/);

  segments.forEach((segment, si) => {
    if (si % 2 === 1) {
      blocks.push(
        <pre key={`code-${si}`} className="md-code">
          <code>{segment.replace(/\n$/, '')}</code>
        </pre>,
      );
      return;
    }

    const lines = segment.split('\n');
    let list: string[] = [];
    let ordered: string[] = [];
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

    const flushOrdered = (key: string) => {
      if (!ordered.length) return;
      blocks.push(
        <ol key={key}>
          {ordered.map((item, li) => (
            <li key={li}>{renderInline(item, `${key}-${li}`)}</li>
          ))}
        </ol>,
      );
      ordered = [];
    };

    const flushPara = (key: string) => {
      if (!para.length) return;
      blocks.push(<p key={key}>{renderInline(para.join(' '), key)}</p>);
      para = [];
    };

    const flushAll = (key: string) => {
      flushList(`l-${key}`);
      flushOrdered(`o-${key}`);
      flushPara(`p-${key}`);
    };

    lines.forEach((line, li) => {
      const key = `${si}-${li}`;
      const heading = line.match(/^\s*(#{1,3})\s+(.*)/);
      const bullet = line.match(/^\s*[-•*]\s+(.*)/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
      if (heading) {
        flushAll(key);
        const level = heading[1].length;
        const Tag = (['h3', 'h4', 'h5'] as const)[level - 1];
        blocks.push(
          <Tag key={`h-${key}`} className={`md-heading md-h${level}`}>
            {renderInline(heading[2], `h-${key}`)}
          </Tag>,
        );
      } else if (bullet) {
        flushOrdered(`o-${key}`);
        flushPara(`p-${key}`);
        list.push(bullet[1]);
      } else if (numbered) {
        flushList(`l-${key}`);
        flushPara(`p-${key}`);
        ordered.push(numbered[1]);
      } else if (line.trim() === '') {
        flushAll(key);
      } else {
        flushList(`l-${key}`);
        flushOrdered(`o-${key}`);
        para.push(line.trim());
      }
    });
    flushAll(`${si}-end`);
  });

  return <div className="md-lite">{blocks}</div>;
};

export default Markdown;
