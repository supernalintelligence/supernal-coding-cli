import mermaid from 'mermaid';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import styles from './SimpleMermaid.module.css';

interface SimpleMermaidProps {
  chart: string;
  id?: string;
  title?: string;
  description?: string;
}

export default function SimpleMermaid({
  chart,
  id,
  title,
  description
}: SimpleMermaidProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const chartId = id || `mermaid-${Math.random().toString(36).substr(2, 9)}`;

  // Touch gesture state
  const [touchState, setTouchState] = useState({
    initialDistance: 0,
    initialZoom: 1,
    isGesturing: false
  });

  useEffect(() => {
    if (chartRef.current) {
      // Initialize mermaid with safe settings
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'inherit'
      });

      // Clear previous content
      chartRef.current.innerHTML = '';

      // Render the chart
      mermaid
        .render(chartId, chart)
        .then(({ svg }) => {
          if (chartRef.current) {
            chartRef.current.innerHTML = svg;
          }
        })
        .catch((error) => {
          console.error('Mermaid rendering error:', error);
          if (chartRef.current) {
            chartRef.current.innerHTML = `
              <div style="padding: 20px; border: 1px solid #ccc; background: #f9f9f9; border-radius: 4px;">
                <strong>Mermaid Diagram Error</strong>
                <pre style="margin-top: 10px; font-size: 12px;">${error.message}</pre>
              </div>
            `;
          }
        });
    }
  }, [chart, chartId]);

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.3, Math.min(5, zoomLevel + delta));
    setZoomLevel(newZoom);
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Helper function to get distance between two touch points
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      (touch2.clientX - touch1.clientX) ** 2 +
        (touch2.clientY - touch1.clientY) ** 2
    );
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two finger gesture - start pinch zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      setTouchState({
        initialDistance: distance,
        initialZoom: zoomLevel,
        isGesturing: true
      });
    } else if (e.touches.length === 1 && zoomLevel > 1) {
      // Single finger - start panning (only if zoomed in)
      const touch = e.touches[0];
      setIsPanning(true);
      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchState.isGesturing) {
      // Two finger gesture - pinch zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      if (touchState.initialDistance > 0) {
        const scale = distance / touchState.initialDistance;
        const newZoom = Math.max(
          0.3,
          Math.min(5, touchState.initialZoom * scale)
        );
        setZoomLevel(newZoom);
      }
    } else if (e.touches.length === 1 && isPanning && zoomLevel > 1) {
      // Single finger - pan
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPanPoint.x;
      const deltaY = touch.clientY - lastPanPoint.y;

      setPanOffset((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setTouchState({
        initialDistance: 0,
        initialZoom: 1,
        isGesturing: false
      });
    }

    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  };

  // Mouse wheel zoom support
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + wheel for zoom
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.3, Math.min(5, zoomLevel + delta));
      setZoomLevel(newZoom);
    }
  };

  const handleFullscreen = () => {
    setIsFullscreen(true);
  };

  const handleCloseFullscreen = () => {
    setIsFullscreen(false);
    setZoomLevel(1); // Reset zoom when closing fullscreen
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
      link.download = `mermaid-diagram-${title || chartId}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === 'png') {
      try {
        // Get SVG data and clean it
        const svgElement = chartRef.current.querySelector('svg');
        if (!svgElement) return;

        // Clone the SVG to avoid modifying the original
        const svgClone = svgElement.cloneNode(true) as SVGElement;

        // Set explicit dimensions if not present
        const rect = svgElement.getBoundingClientRect();
        if (!svgClone.getAttribute('width')) {
          svgClone.setAttribute('width', rect.width.toString());
        }
        if (!svgClone.getAttribute('height')) {
          svgClone.setAttribute('height', rect.height.toString());
        }

        const svgData = new XMLSerializer().serializeToString(svgClone);

        // Create a data URL instead of blob URL to avoid CORS issues
        const svgDataUrl =
          'data:image/svg+xml;base64,' +
          btoa(unescape(encodeURIComponent(svgData)));

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        // Set canvas size with higher resolution
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx?.scale(2, 2);

        img.onload = () => {
          try {
            ctx?.drawImage(img, 0, 0);

            // Convert to blob and download
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `mermaid-diagram-${title || chartId}.png`;
                link.click();
                URL.revokeObjectURL(url);
              }
            }, 'image/png');
          } catch (error) {
            console.error('Error converting to PNG:', error);
            // Fallback: just download the SVG
            handleExport('svg');
          }
        };

        img.onerror = () => {
          console.error('Error loading SVG for PNG conversion');
          // Fallback: just download the SVG
          handleExport('svg');
        };

        img.src = svgDataUrl;
      } catch (error) {
        console.error('Error exporting PNG:', error);
        // Fallback: just download the SVG
        handleExport('svg');
      }
    }
  };

  // Handle keyboard shortcuts in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleCloseFullscreen();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoom(0.2);
          break;
        case '-':
          e.preventDefault();
          handleZoom(-0.2);
          break;
        case '0':
          e.preventDefault();
          handleZoomReset();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handleCloseFullscreen, handleZoom, handleZoomReset]);

  const chartContainer = (
    <div
      ref={chartRef}
      className={styles.chartContainer}
      style={{
        transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
        transformOrigin: 'center',
        cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    />
  );

  const controls = (
    <div className={styles.controls}>
      <div className={styles.zoomControls}>
        <button onClick={handleZoomReset} title="Reset Zoom (0)">
          Reset
        </button>
        <button onClick={() => handleZoom(-0.2)} title="Zoom Out (-)">
          −
        </button>
        <button onClick={() => handleZoom(0.2)} title="Zoom In (+)">
          +
        </button>
        <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
      </div>

      <div className={styles.actionControls}>
        <button onClick={() => handleExport('svg')} title="Export as SVG">
          Export SVG
        </button>
        <button onClick={() => handleExport('png')} title="Export as PNG">
          Export PNG
        </button>
        <button
          onClick={handleFullscreen}
          title="Fullscreen"
          className={styles.fullscreenButton}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          </svg>
        </button>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className={styles.fullscreenOverlay}>
        <div className={styles.fullscreenContainer}>
          <div className={styles.fullscreenHeader}>
            {title && <h3 className={styles.fullscreenTitle}>{title}</h3>}
            <div className={styles.fullscreenControls}>
              {controls}
              <button
                onClick={handleCloseFullscreen}
                className={styles.closeButton}
                title="Close Fullscreen (Esc)"
              >
                Close
              </button>
            </div>
          </div>
          <div className={styles.fullscreenContent}>{chartContainer}</div>
          <div className={styles.fullscreenHint}>
            Use +/- to zoom, 0 to reset, Esc to close • Touch: pinch to zoom,
            drag to pan • Mouse: Ctrl+wheel to zoom
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {(title || description) && (
        <div className={styles.header}>
          {title && <h4 className={styles.title}>{title}</h4>}
          {description && <p className={styles.description}>{description}</p>}
        </div>
      )}

      {controls}

      {chartContainer}
    </div>
  );
}
