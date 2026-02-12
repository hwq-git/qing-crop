import { useState, useCallback } from 'react';
import { FileUploader } from './components/FileUploader';
import { CanvasEditor } from './components/CanvasEditor';
import { PdfViewer } from './components/PdfViewer';
import { CharacterManager } from './components/CharacterManager';
import { OCRPanel } from './components/OCRPanel';
import { Toaster, toast } from 'sonner';
import { Scissors, Info, Scan, Image as ImageIcon, FileText, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CharacterItem } from '@/utils/ocrEngine';
import './App.css';

function App() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [activeTab, setActiveTab] = useState('cut');
  
  // 全局字符列表（OCR + 手动切割）
  const [characters, setCharacters] = useState<CharacterItem[]>([]);

  const handleFileSelect = useCallback((file: File) => {
    setIsLoading(true);
    setCurrentFile(file);
    setCharacters([]); // 清空之前的字符

    if (file.type === 'application/pdf') {
      setIsPdf(true);
      setImageUrl(null);
      setImageSource(null);
    } else if (file.type.startsWith('image/')) {
      setIsPdf(false);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      
      // 创建图片元素
      const img = new Image();
      img.onload = () => {
        setImageSource(img);
      };
      img.src = url;
      
      toast.success('图片加载成功');
    } else {
      toast.error('不支持的文件格式');
    }

    setIsLoading(false);
  }, []);

  const handleClear = useCallback(() => {
    if (imageUrl && !isPdf) {
      URL.revokeObjectURL(imageUrl);
    }
    setCurrentFile(null);
    setImageUrl(null);
    setImageSource(null);
    setIsPdf(false);
    setCharacters([]);
  }, [imageUrl, isPdf]);

  const handlePdfImageReady = useCallback((url: string) => {
    setImageUrl(url);
    
    // 创建图片元素
    const img = new Image();
    img.onload = () => {
      setImageSource(img);
    };
    img.src = url;
    
    toast.success('PDF转换成功');
  }, []);

  // 添加字符到列表
  const handleAddCharacters = useCallback((newChars: CharacterItem[]) => {
    setCharacters(prev => [...prev, ...newChars]);
  }, []);

  // 更新字符列表
  const handleCharactersChange = useCallback((newChars: CharacterItem[]) => {
    setCharacters(newChars);
  }, []);



  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">智能字符切割工具</h1>
              <p className="text-xs text-gray-500">OCR识别 · 字符归类 · 批量处理</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Info className="w-4 h-4" />
                  使用说明
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle>使用说明</DialogTitle>
                  <DialogDescription>
                    <div className="space-y-4 mt-4 text-left">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-blue-900 mb-2">基本流程</h3>
                        <div className="space-y-2 text-sm text-blue-800">
                          <div className="flex gap-2">
                            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
                            <p>上传图片或PDF文件（支持拖拽上传）</p>
                          </div>
                          <div className="flex gap-2">
                            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
                            <p>选择"切割模式"手动绘制区域，或切换到"OCR模式"自动识别</p>
                          </div>
                          <div className="flex gap-2">
                            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
                            <p>所有切割/识别的字符会自动归类到字符库</p>
                          </div>
                          <div className="flex gap-2">
                            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
                            <p>在字符库中可以编辑、删除、导出字符</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-green-900 mb-2">OCR 功能</h3>
                        <div className="space-y-2 text-sm text-green-800">
                          <div className="flex gap-2">
                            <Scan className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>支持自动识别图片中的文字</p>
                          </div>
                          <div className="flex gap-2">
                            <Scan className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>识别结果自动按字符归类</p>
                          </div>
                          <div className="flex gap-2">
                            <Scan className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>支持手动添加、删除、修改识别的字符</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-purple-900 mb-2">字符库</h3>
                        <div className="space-y-2 text-sm text-purple-800">
                          <div className="flex gap-2">
                            <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>所有切割和OCR识别的字符都会进入字符库</p>
                          </div>
                          <div className="flex gap-2">
                            <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>相同字符自动归类，方便批量处理</p>
                          </div>
                          <div className="flex gap-2">
                            <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>支持导出JSON数据和图片</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Upload */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                </span>
                上传文件
              </h2>
              <FileUploader
                onFileSelect={handleFileSelect}
                onClear={handleClear}
                currentFile={currentFile}
                isLoading={isLoading}
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-green-600" />
                </span>
                文件信息
              </h2>
              {currentFile ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">文件名</span>
                    <span className="font-medium truncate max-w-[150px]">{currentFile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">类型</span>
                    <span className="font-medium">{isPdf ? 'PDF' : '图片'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">大小</span>
                    <span className="font-medium">{(currentFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  {imageSource && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">尺寸</span>
                        <span className="font-medium">{imageSource.width} × {imageSource.height}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">暂无文件</p>
              )}
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-sm border border-indigo-100 p-5">
              <h2 className="text-lg font-semibold mb-4 text-indigo-900">功能特点</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Scan className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-900">OCR 智能识别</p>
                    <p className="text-indigo-700 text-xs">自动识别图片中的文字</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Scissors className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-900">手动精确切割</p>
                    <p className="text-indigo-700 text-xs">支持矩形和圆形切割</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Layers className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-900">自动归类</p>
                    <p className="text-indigo-700 text-xs">相同字符自动分组</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Editor */}
          <div className="lg:col-span-3 space-y-6">
            {/* 字符库面板 - 始终显示 */}
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-pink-600" />
                </span>
                字符库
                {characters.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({characters.length} 个字符)
                  </span>
                )}
              </h2>
              <CharacterManager
                characters={characters}
                onCharactersChange={handleCharactersChange}
                imageSource={imageSource}
              />
            </div>

            {/* 切割/OCR 标签页 */}
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="cut" className="gap-2">
                    <Scissors className="w-4 h-4" />
                    切割模式
                  </TabsTrigger>
                  <TabsTrigger value="ocr" className="gap-2">
                    <Scan className="w-4 h-4" />
                    OCR 识别
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="cut" className="mt-0">
                  {isPdf && currentFile && (
                    <PdfViewer file={currentFile} onImageReady={handlePdfImageReady} />
                  )}
                  <div className="mt-2">
                    <CanvasEditor 
                      imageUrl={imageUrl} 
                      imageSource={imageSource}
                      onClear={handleClear}
                      onCharactersAdd={handleAddCharacters}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="ocr" className="mt-0">
                  {isPdf && currentFile && imageUrl && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                      PDF 已转换为图片，可以进行 OCR 识别
                    </div>
                  )}
                  <OCRPanel 
                    imageSource={imageSource}
                    characters={characters}
                    onCharactersChange={handleCharactersChange}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>支持格式：JPG, PNG, GIF, PDF</span>
              <span className="hidden sm:inline">|</span>
              <span>本地处理，文件不会上传到服务器</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>系统就绪</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
