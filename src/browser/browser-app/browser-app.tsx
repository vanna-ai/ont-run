import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserApp } from './components/BrowserApp';
import type { GraphData } from './types';
import './styles.css';

const App: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const response = await fetch('/api/graph');
        if (!response.ok) {
          throw new Error('Failed to fetch graph data');
        }
        const data = await response.json();
        setGraphData(data);
      } catch (err) {
        console.error('Error fetching graph data:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'Space Grotesk, sans-serif',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '12px' }}>Loading ontology data...</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Please wait</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'Space Grotesk, sans-serif',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--change-removed)' }}>
            Error loading data
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!graphData) {
    return null;
  }

  return <BrowserApp graphData={graphData} />;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
