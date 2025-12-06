import mermaid from 'mermaid';
import React, { useRef, useState } from 'react';
import styles from './InteractiveMermaid.module.css';

interface InteractiveMermaidProps {
  chart: string;
  title?: string;
  description?: string;
  allowEdit?: boolean;
}

export default function InteractiveMermaid({
  chart,
  title,
  description,
  allowEdit = false
}: InteractiveMermaidProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableChart, setEditableChart] = useState(chart);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose'
    });

    if (chartRef.current) {
      const chartCode = isEditing ? editableChart : chart;
      mermaid
        .render(`mermaid-chart-${Math.random()}`, chartCode)
        .then(({ svg }) => {
          if (chartRef.current) {
            chartRef.current.innerHTML = svg;
          }
        })
        .catch(console.error);
    }
  }, [chart, editableChart, isEditing]);

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.5, Math.min(3, zoomLevel + delta));
    setZoomLevel(newZoom);
    if (chartRef.current) {
      chartRef.current.style.transform = `scale(${newZoom})`;
      chartRef.current.style.transformOrigin = 'center';
    }
  };

  const handleExport = async (format: 'svg' | 'png') => {
    if (!chartRef.current) return;

    const svgElement = chartRef.current.querySelector('svg');
    if (!svgElement) return;

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mermaid-diagram-${title || 'chart'}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === 'png') {
      // Convert SVG to PNG using canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `mermaid-diagram-${title || 'chart'}.png`;
            link.click();
            URL.revokeObjectURL(url);
          }
        }, 'image/png');

        URL.revokeObjectURL(url);
      };

      img.src = url;
    }
  };

  const handleApplyEdit = () => {
    setIsEditing(false);
    // In a real implementation, you might want to validate the chart first
  };

  return (
    <div className={styles.container}>
      {title && (
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button
            className={styles.controlsToggle}
            onClick={() => setShowControls(!showControls)}
            title="Toggle controls"
          >
            ⚙️
          </button>
        </div>
      )}

      {description && <p className={styles.description}>{description}</p>}

      {showControls && (
        <div className={styles.controls}>
          <div className={styles.zoomControls}>
            <button onClick={() => handleZoom(-0.2)}>🔍−</button>
            <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => handleZoom(0.2)}>🔍+</button>
            <button onClick={() => setZoomLevel(1)}>Reset</button>
          </div>

          <div className={styles.exportControls}>
            <button onClick={() => handleExport('svg')}>📁 SVG</button>
            <button onClick={() => handleExport('png')}>🖼️ PNG</button>
          </div>

          {allowEdit && (
            <div className={styles.editControls}>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={isEditing ? styles.editingActive : ''}
              >
                ✏️ {isEditing ? 'Cancel' : 'Edit'}
              </button>
              {isEditing && (
                <button
                  onClick={handleApplyEdit}
                  className={styles.applyButton}
                >
                  ✅ Apply
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isEditing ? (
        <div className={styles.editMode}>
          <textarea
            value={editableChart}
            onChange={(e) => setEditableChart(e.target.value)}
            className={styles.chartEditor}
            rows={10}
            placeholder="Edit your Mermaid chart here..."
          />
        </div>
      ) : (
        <div
          ref={chartRef}
          className={styles.chartContainer}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center'
          }}
        />
      )}
    </div>
  );
}
