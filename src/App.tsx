import { useState, useCallback, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { CanvasEditor } from './components/CanvasEditor';
import { PdfViewer } from './components/PdfViewer';
import { CharacterManager } from './components/CharacterManager';
import { EnhancedOCRPanel } from './components/EnhancedOCRPanel';
import { Toaster, toast } from 'sonner';
import { 
  Scissors, 
  Scan, 
  Image as ImageIcon, 
  FileText, 
  Layers,
  RotateCw,
  Undo2,
  Redo2,
  Keyboard,
  Save,
  ClipboardPaste,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import type { CharacterItem } from '@/utils/ocrEngine';
import { getHistoryManager } from '@/utils/historyManager';
import { getAutoSaveManager } from '@/utils/autoSaveManager';
import { getKeyboardManager } from '@/utils/keyboardManager';
import { getClipboardManager } from '@/utils/clipboardManager';
import { rotateImage, rotateCharacters, type RotationAngle } from '@/utils/rotationUtils';
import './App.css';

function App() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<HTMLImageElement | null>(null);
  const [rotatedImageSource, setRotatedImageSource] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState<RotationAngle>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [activeTab, setActiveTab] = useState('cut');
  
  // 全局字符列表（OCR + 手动切割）
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  
  // 历史记录状态
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyCount, setHistoryCount] = useState({ undo: 0, redo: 0 });

  // 初始化
  useEffect(() => {
    const keyboard = getKeyboardManager();
    const autoSave = getAutoSaveManager();

    // 初始化键盘监听
    keyboard.init();
    keyboard.addHandler(handleKeyboardShortcut);

    // 检查自动保存
    if (autoSave.hasSavedData()) {
      toast.info('检测到未保存的工作，点击"恢复工作"可继续编辑', {
        action: {
          label: '恢复工作',
          onClick: restoreAutoSave,
        },
      });
    }

    // 开始自动保存
    autoSave.startAutoSave(() => ({
      imageData: imageUrl,
      imageName: currentFile?.name || '',
      characters,
      rotation,
    }));

    return () => {
      keyboard.destroy();
      autoSave.stopAutoSave();
    };
  }, []);

  // 更新历史状态
  useEffect(() => {
    const history = getHistoryManager();
    setCanUndo(history.canUndo());
    setCanRedo(history.canRedo());
    setHistoryCount(history.getHistoryCount());
  }, [characters, rotation]);

  // 键盘快捷键处理
  const handleKeyboardShortcut = useCallback((action: string, _event: KeyboardEvent) => {
    switch (action) {
      case 'undo':
        handleUndo();
        break;
      case 'redo':
        handleRedo();
        break;
      case 'save':
        handleSaveProject();
        break;
      case 'rotate':
        handleRotate();
        break;
      case 'ocr':
        setActiveTab('ocr');
        break;
      case 'export':
        // 触发导出
        break;
      case 'paste':
        handleClipboardPaste();
        break;
    }
  }, [characters, rotation, imageSource]);

  // 撤销
  const handleUndo = () => {
    const history = getHistoryManager();
    const state = history.undo();
    if (state) {
      setCharacters(state.characters);
      setRotation(state.rotation as RotationAngle);
      toast.success('已撤销');
    }
  };

  // 重做
  const handleRedo = () => {
    const history = getHistoryManager();
    const state = history.redo();
    if (state) {
      setCharacters(state.characters);
      setRotation(state.rotation as RotationAngle);
      toast.success('已重做');
    }
  };

  // 旋转图片
  const handleRotate = () => {
    if (!imageSource) {
      toast.error('请先上传图片');
      return;
    }

    const history = getHistoryManager();
    const prevCharacters = [...characters];

    // 计算新角度
    const newRotation = ((rotation + 90) % 360) as RotationAngle;
    
    // 旋转图片
    const rotated = rotateImage(imageSource, newRotation);
    
    // 创建新的图片元素
    const img = new Image();
    img.onload = () => {
      setRotatedImageSource(img);
      
      // 旋转字符坐标
      const rotatedChars = rotateCharacters(
        characters,
        90, // 每次旋转90度
        imageSource.width,
        imageSource.height
      );
      
      setCharacters(rotatedChars);
      setRotation(newRotation);

      // 记录历史
      history.execute(
        'rotate_image',
        `旋转图片 ${newRotation}°`,
        prevCharacters,
        rotatedChars,
        newRotation
      );

      toast.success(`已旋转 ${newRotation}°`);
    };
    img.src = rotated.canvas.toDataURL();
  };

  // 剪贴板粘贴
  const handleClipboardPaste = async () => {
    const clipboard = getClipboardManager();
    const text = await clipboard.readText();
    
    if (text) {
      toast.success(`从剪贴板读取: "${text}"`);
      // TODO: 智能匹配到字符框
    }
  };

  // 保存项目
  const handleSaveProject = () => {
    const autoSave = getAutoSaveManager();
    autoSave.save({
      imageData: imageUrl,
      imageName: currentFile?.name || '',
      characters,
      rotation,
    });
    toast.success('项目已保存');
  };

  // 恢复自动保存
  const restoreAutoSave = () => {
    const autoSave = getAutoSaveManager();
    const data = autoSave.load();
    if (data) {
      setCharacters(data.characters);
      setRotation(data.rotation as RotationAngle);
      toast.success('已恢复工作');
    }
  };

  // 文件选择
  const handleFileSelect = useCallback((file: File) => {
    setIsLoading(true);
    setCurrentFile(file);
    setCharacters([]);
    setRotation(0);

    // 初始化历史
    const history = getHistoryManager();
    history.initState([], 0);

    if (file.type === 'application/pdf') {
      setIsPdf(true);
      setImageUrl(null);
      setImageSource(null);
      setRotatedImageSource(null);
    } else if (file.type.startsWith('image/')) {
      setIsPdf(false);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      
      const img = new Image();
      img.onload = () => {
        setImageSource(img);
        setRotatedImageSource(img);
      };
      img.src = url;
      
      toast.success('图片加载成功');
    } else {
      toast.error('不支持的文件格式');
    }

    setIsLoading(false);
  }, []);

  // 清空
  const handleClear = useCallback(() => {
    if (imageUrl && !isPdf) {
      URL.revokeObjectURL(imageUrl);
    }
    setCurrentFile(null);
    setImageUrl(null);
    setImageSource(null);
    setRotatedImageSource(null);
    setIsPdf(false);
    setCharacters([]);
    setRotation(0);
  }, [imageUrl, isPdf]);

  // PDF转换完成
  const handlePdfImageReady = useCallback((url: string) => {
    setImageUrl(url);
    
    const img = new Image();
    img.onload = () => {
      setImageSource(img);
      setRotatedImageSource(img);
    };
    img.src = url;
    
    toast.success('PDF转换成功');
  }, []);

  // 添加字符
  const handleAddCharacters = useCallback((newChars: CharacterItem[]) => {
    const history = getHistoryManager();
    const prevChars = [...characters];
    const nextChars = [...characters, ...newChars];
    
    history.execute('batch_add', `添加 ${newChars.length} 个字符`, prevChars, nextChars, rotation);
    setCharacters(nextChars);
  }, [characters, rotation]);

  // 更新字符
  const handleCharactersChange = useCallback((newChars: CharacterItem[]) => {
    setCharacters(newChars);
  }, []);

  // 获取显示用的图片源
  const displayImageSource = rotatedImageSource || imageSource;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">智能字符切割工具</h1>
              <p className="text-xs text-gray-500">OCR识别 · 字符归类 · 批量处理</p>
            </div>
          </div>

          {/* 工具栏 */}
          <div className="flex items-center gap-2">
            {/* 撤销/重做 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUndo}
                disabled={!canUndo}
                className="h-8 px-2"
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
                {historyCount.undo > 0 && (
                  <span className="ml-1 text-xs">{historyCount.undo}</span>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRedo}
                disabled={!canRedo}
                className="h-8 px-2"
                title="重做 (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
                {historyCount.redo > 0 && (
                  <span className="ml-1 text-xs">{historyCount.redo}</span>
                )}
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* 旋转 */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRotate}
              disabled={!imageSource}
              className="gap-1"
              title="旋转90° (Ctrl+R)"
            >
              <RotateCw className="w-4 h-4" />
              旋转{rotation > 0 && ` ${rotation}°`}
            </Button>

            {/* 保存 */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveProject}
              disabled={characters.length === 0}
              className="gap-1"
              title="保存项目 (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
              保存
            </Button>

            {/* 剪贴板 */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleClipboardPaste}
              className="gap-1"
              title="粘贴剪贴板 (Ctrl+V)"
            >
              <ClipboardPaste className="w-4 h-4" />
              粘贴
            </Button>

            <div className="w-px h-6 bg-gray-300" />

            {/* 使用说明 */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Keyboard className="w-4 h-4" />
                  快捷键
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>键盘快捷键</DialogTitle>
                  <DialogDescription>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>撤销</span>
                        <kbd className="bg-white px-2 py-0.5 rounded border">Ctrl+Z</kbd>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>重做</span>
                        <kbd className="bg-white px-2 py-0.5 rounded border">Ctrl+Y</kbd>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>旋转90°</span>
                        <kbd className="bg-white px-2 py-0.5 rounded border">Ctrl+R</kbd>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>保存</span>
                        <kbd className="bg-white px-2 py-0.5 rounded border">Ctrl+S</kbd>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>OCR识别</span>
                        <kbd className="bg-white px-2 py-0.5 rounded border">Ctrl+O</kbd>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>粘贴</span>
                        <kbd className="bg-white px-2 py-0.5 rounded border">Ctrl+V</kbd>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>删除选中</span>
                        <kbd className="bg-white px-2 py-0.5 rounded border">Delete</kbd>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>方向键微调</span>
                        <kbd className="bg-white px-2 py-0.5 rounded border">↑↓←→</kbd>
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
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Upload */}
          <div className="lg:col-span-1 space-y-4">
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

            {/* 文件信息 */}
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-green-600" />
                </span>
                文件信息
              </h2>
              {currentFile ? (
                <div className="space-y-2 text-sm">
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
                      {rotation > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">旋转</span>
                          <Badge variant="secondary">{rotation}°</Badge>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">暂无文件</p>
              )}
            </div>

            {/* 功能特点 */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-sm border border-indigo-100 p-5">
              <h2 className="text-lg font-semibold mb-4 text-indigo-900">功能特点</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Scan className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-900">OCR 智能识别</p>
                    <p className="text-indigo-700 text-xs">支持中英文识别</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <RotateCw className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-900">竖排文字支持</p>
                    <p className="text-indigo-700 text-xs">古籍竖排一键旋转</p>
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

          {/* Right Panel */}
          <div className="lg:col-span-3 space-y-4">
            {/* 字符库面板 */}
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
                imageSource={displayImageSource}
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
                      imageSource={displayImageSource}
                      originalImageSource={imageSource}
                      rotation={rotation}
                      onClear={handleClear}
                      onCharactersAdd={handleAddCharacters}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="ocr" className="mt-0">
                  <EnhancedOCRPanel 
                    imageSource={displayImageSource}
                    rotation={rotation}
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
      <footer className="border-t bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>支持格式：JPG, PNG, GIF, PDF</span>
              <span className="hidden sm:inline">|</span>
              <span>快捷键：Ctrl+Z 撤销 / Ctrl+R 旋转</span>
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
