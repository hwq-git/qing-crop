import React, { useCallback, useRef } from 'react';
import { Upload, Image as ImageIcon, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onClear: () => void;
  currentFile: File | null;
  isLoading?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  onClear,
  currentFile,
  isLoading = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) {
        const validTypes = ['image/', 'application/pdf'];
        if (validTypes.some((type) => file.type.startsWith(type))) {
          onFileSelect(file);
        }
      }
    },
    [onFileSelect]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    }
    if (file.type === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <Upload className="w-5 h-5" />;
  };

  return (
    <div className="w-full">
      {!currentFile ? (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-700">
                点击或拖拽上传文件
              </p>
              <p className="text-sm text-gray-500 mt-1">
                支持图片 (JPG, PNG, GIF) 和 PDF 文件
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getFileIcon(currentFile)}
              <div>
                <p className="font-medium text-gray-800 truncate max-w-[200px]">
                  {currentFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(currentFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={isLoading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
