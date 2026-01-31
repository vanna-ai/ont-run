import React, { useEffect, useState } from 'react';
import { highlightTypeScript } from '../utils/formatting';

export const SourceView: React.FC = () => {
  const [source, setSource] = useState('');
  const [filename, setFilename] = useState('ontology.config.ts');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadSource = async () => {
      try {
        const res = await fetch('/api/source');
        if (!res.ok) throw new Error('Failed to load source');
        const data = await res.json();
        setSource(data.source);
        setFilename(data.filename);
      } catch (err) {
        setSource(`Error loading source: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    loadSource();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="source-view active">
      <div className="source-header">
        <span className="source-filename">{filename}</span>
        <button
          className={`copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="source-code">
        <code
          dangerouslySetInnerHTML={{
            __html: loading ? 'Loading...' : highlightTypeScript(source),
          }}
        />
      </pre>
    </div>
  );
};
