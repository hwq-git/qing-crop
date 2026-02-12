import React, { useEffect, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PdfViewerProps {
  file: File;
  onImageReady: (imageUrl: string) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, onImageReady }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setIsLoading(true);
        const arrayBuffer = await file.arrayBuffer();
        
        // 使用 PDF.js CDN
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) {
          // 动态加载 PDF.js
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            loadPdf();
          };
          document.head.appendChild(script);
          return;
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setTotalPages(pdf.numPages);
        await renderPage(pdf, 1);
      } catch (error) {
        toast.error('PDF加载失败');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [file]);

  const renderPage = async (pdf: any, pageNum: number) => {
    try {
      const page = await pdf.getPage(pageNum);
      const scale = 2;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const url = canvas.toDataURL('image/png');
      setImageUrl(url);
      onImageReady(url);
    } catch (error) {
      toast.error('页面渲染失败');
      console.error(error);
    }
  };

  const handlePrevPage = async () => {
    if (currentPage > 1 && window.pdfjsLib) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      await renderPage(pdf, newPage);
    }
  };

  const handleNextPage = async () => {
    if (currentPage < totalPages && window.pdfjsLib) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      await renderPage(pdf, newPage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">加载PDF中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 p-3 bg-gray-100 rounded-lg">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            第 {currentPage} 页 / 共 {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
      {imageUrl && (
        <div className="text-center text-sm text-gray-500">
          PDF已转换为图片，可在下方进行切割操作
        </div>
      )}
    </div>
  );
};

// 扩展 Window 接口
declare global {
  interface Window {
    pdfjsLib: any;
  }
}
