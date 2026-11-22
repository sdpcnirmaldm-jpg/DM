import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { FileWarning } from 'lucide-react';
import { parseDataUrl } from '../utils/aiContext';
import { decodeBase64ToBytes } from '../utils/patientDocuments';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfCanvasViewerProps {
  dataUrl: string;
  fileName: string;
  zoomPct?: number;
  maxHeightClass?: string;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  dataUrl,
  fileName,
  zoomPct = 100,
  maxHeightClass = 'max-h-[600px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    const activeRenderTasks: Array<{ cancel: () => void }> = [];

    const renderPdf = async () => {
      const container = containerRef.current;
      if (!container) return;

      setLoading(true);
      setError(null);
      setPageCount(0);
      container.innerHTML = '';

      try {
        const parsed = parseDataUrl(dataUrl, fileName);
        if (!parsed) {
          throw new Error('Missing PDF file payload.');
        }

        const bytes = decodeBase64ToBytes(parsed.base64Data);
        loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        setPageCount(pdfDoc.numPages);

        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        const containerWidth = Math.max(container.clientWidth - 24, 320);

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const fitScale = Math.min(1.6, containerWidth / baseViewport.width);
          const displayScale = fitScale * (zoomPct / 100);
          const viewport = page.getViewport({ scale: displayScale });

          const pageWrapper = document.createElement('div');
          pageWrapper.className =
            'bg-white border border-[#DDE8E2] rounded-xl shadow-xs overflow-hidden mx-auto';
          pageWrapper.style.width = `${Math.floor(viewport.width)}px`;

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className = 'block';
          canvas.setAttribute('aria-label', `${fileName} page ${pageNum}`);

          pageWrapper.appendChild(canvas);

          if (pdfDoc.numPages > 1) {
            const caption = document.createElement('div');
            caption.className =
              'px-3 py-1 bg-[#F6F9F7] border-t border-[#EEF3F0] text-[10px] font-mono text-[#4B6157] text-right';
            caption.textContent = `Page ${pageNum} / ${pdfDoc.numPages}`;
            pageWrapper.appendChild(caption);
          }

          container.appendChild(pageWrapper);

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const renderTask = page.render({
            canvasContext: ctx,
            viewport,
            canvas,
          });
          activeRenderTasks.push(renderTask);
          await renderTask.promise;
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to render this PDF inline. Use Download to open locally.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
      activeRenderTasks.forEach((task) => {
        try {
          task.cancel();
        } catch {
          // ignore cancelled render task errors
        }
      });
      if (loadingTask) {
        void loadingTask.destroy().catch(() => {});
      }
    };
  }, [dataUrl, fileName, zoomPct]);

  return (
    <div
      data-testid="pdf-canvas-viewer"
      data-page-count={pageCount}
      className="relative flex-1 flex flex-col"
    >
      {loading && (
        <div className="py-10 text-center text-xs text-[#4B6157]">
          Rendering PDF document...
        </div>
      )}

      {error && (
        <div className="bg-white border border-[#DDE8E2] rounded-xl p-6 text-center space-y-2">
          <FileWarning className="w-7 h-7 text-amber-600 mx-auto" />
          <div className="text-xs font-semibold text-[#14201B]">
            Inline PDF Rendering Issue
          </div>
          <p className="text-xs text-[#4B6157]">{error}</p>
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full overflow-auto space-y-4 py-1 ${maxHeightClass} ${
          error ? 'hidden' : ''
        }`}
      />
    </div>
  );
};
