import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { CanvasEquationPayload } from '../canvasTypes';

interface Props {
  payload: CanvasEquationPayload;
}

/**
 * Renders LaTeX via KaTeX. `katex.renderToString` produces KaTeX's own
 * trusted markup (not arbitrary HTML) from a math-syntax string, which is
 * the standard, safe way to use KaTeX in React — `throwOnError: false` means
 * malformed LaTeX degrades to an inline error span instead of crashing.
 */
export const EquationRenderer: React.FC<Props> = ({ payload }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(payload.latex, { throwOnError: false, displayMode: true });
    } catch {
      return null;
    }
  }, [payload.latex]);

  return (
    <div className="ai-canvas-equation">
      {html ? (
        // eslint-disable-next-line react/no-danger
        <div className="ai-canvas-equation-render" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <code className="ai-canvas-equation-raw">{payload.latex}</code>
      )}
      {payload.highlightTerms && payload.highlightTerms.length > 0 && (
        <div className="ai-canvas-equation-terms">
          {payload.highlightTerms.map((term, i) => (
            <span key={i} className="ai-canvas-term-chip">{term}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default EquationRenderer;
