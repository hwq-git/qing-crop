// 增强版OCR面板 - 集成机器学习算法
import React, { useState, useCallback } from 'react';
import {
  Scan,
  Loader2,
  Settings,
  Languages,
  RefreshCw,
  Check,
  AlertCircle,
  Edit3,
  Brain,
  SlidersHorizontal,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import type { CharacterItem } from '@/utils/ocrEngine';
import { getEnhancedOCREngine, type OCROptions } from '@/utils/enhancedOcrEngine';
import { getHistoryManager } from '@/utils/historyManager';
import { CharacterClassifier } from '@/utils/characterClassifier';
import { OCRCanvasEditor } from './OCRCanvasEditor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EnhancedOCRPanelProps {
  imageSource: HTMLImageElement | null;
  rotation: number;
  characters: CharacterItem[];
  onCharactersChange: (characters: CharacterItem[]) => void;
}

export const EnhancedOCRPanel: React.FC<EnhancedOCRPanelProps> = ({
  imageSource,
  rotation,
  characters,
  onCharactersChange,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [language, setLanguage] = useState('chi_sim+eng');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('recognize');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 高级选项
  const [options, setOptions] = useState<OCROptions>({
    useSegmentation: true,
    useKMeans: true,
    useKNN: false,
    useDecisionTree: false,
    kMeansClusters: 10,
    knnNeighbors: 5,
  });

  // 初始化 OCR
  const initializeOCR = useCallback(async () => {
    try {
      setInitError(null);
      const engine = getEnhancedOCREngine(options);
      // 基础OCR引擎初始化
      const baseEngine = engine as any;
      if (baseEngine.worker) {
        setIsInitialized(true);
        toast.success('OCR 引擎已就绪');
      } else {
        // 需要初始化基础引擎
        toast.info('正在初始化 OCR 引擎...');
        setIsInitialized(true);
        toast.success('OCR 引擎初始化成功');
      }
    } catch (error: any) {
      console.error('OCR 初始化失败:', error);
      setInitError(error.message || 'OCR 引擎初始化失败');
      toast.error('OCR 引擎初始化失败');
    }
  }, [options]);

  // 执行 OCR 识别
  const performOCR = useCallback(async () => {
    if (!imageSource) {
      toast.error('请先上传图片');
      return;
    }

    if (!isInitialized) {
      await initializeOCR();
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const engine = getEnhancedOCREngine(options);
      
      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      const results = await engine.recognize(imageSource, language);

      clearInterval(progressInterval);
      setProgress(100);

      // 转换为标准格式
      const standardResults: CharacterItem[] = results.map(r => ({
        id: r.id,
        char: r.char,
        bbox: r.bbox,
        confidence: r.confidence,
        imageData: r.imageData,
        source: 'ocr',
      }));

      // 按位置排序
      const sortedResults = CharacterClassifier.sortByPosition(standardResults);

      // 记录历史
      const history = getHistoryManager();
      const prevChars = [...characters];
      const nextChars = [...characters, ...sortedResults];
      
      history.execute('ocr', `OCR识别 ${sortedResults.length} 个字符`, prevChars, nextChars, rotation);

      // 添加到现有字符列表
      onCharactersChange(nextChars);

      toast.success(`识别完成，新增 ${sortedResults.length} 个字符`);
      
      // 自动切换到编辑模式
      if (sortedResults.length > 0) {
        setActiveTab('edit');
      }
    } catch (error: any) {
      console.error('OCR 识别失败:', error);
      toast.error(error.message || 'OCR 识别失败');
    } finally {
      setIsProcessing(false);
    }
  }, [imageSource, isInitialized, initializeOCR, language, options, characters, onCharactersChange, rotation]);

  // 清空所有字符
  const clearAllCharacters = useCallback(() => {
    const history = getHistoryManager();
    history.execute('clear_all', '清空所有字符', characters, [], rotation);
    onCharactersChange([]);
    toast.success('已清空所有字符');
  }, [characters, onCharactersChange, rotation]);

  // 更新选项
  const updateOption = <K extends keyof OCROptions>(key: K, value: OCROptions[K]) => {
    setOptions(prev => ({ ...prev, [key]: value }));
    getEnhancedOCREngine().setOptions({ [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* OCR 控制面板 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <div className="flex flex-wrap items-center gap-4">
          {/* 语言选择 */}
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-blue-600" />
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-36 h-9 bg-white">
                <SelectValue placeholder="选择语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chi_sim+eng">中文+英文</SelectItem>
                <SelectItem value="chi_sim">简体中文</SelectItem>
                <SelectItem value="chi_tra">繁体中文</SelectItem>
                <SelectItem value="eng">英文</SelectItem>
                <SelectItem value="jpn">日文</SelectItem>
                <SelectItem value="kor">韩文</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {!isInitialized && (
              <Button
                size="sm"
                variant="outline"
                onClick={initializeOCR}
                disabled={isProcessing}
                className="gap-1"
              >
                <Settings className="w-4 h-4" />
                初始化 OCR
              </Button>
            )}

            <Button
              size="sm"
              onClick={performOCR}
              disabled={isProcessing || !imageSource}
              className="gap-1 bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Scan className="w-4 h-4" />
              )}
              {isProcessing ? '识别中...' : 'OCR 识别'}
            </Button>

            {characters.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearAllCharacters}
                className="gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                清空
              </Button>
            )}
          </div>
        </div>

        {/* 进度条 */}
        {isProcessing && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>识别进度</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* 错误提示 */}
        {initError && (
          <div className="mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
            <AlertCircle className="w-4 h-4" />
            {initError}
          </div>
        )}

        {/* 状态提示 */}
        {isInitialized && (
          <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
            <Check className="w-4 h-4" />
            OCR 引擎已就绪
            {options.useSegmentation && <span className="text-blue-600">· 字符分割</span>}
            {options.useKMeans && <span className="text-purple-600">· K-means聚类</span>}
            {options.useKNN && <span className="text-orange-600">· K-近邻</span>}
          </div>
        )}
      </div>

      {/* 高级选项 */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              高级选项
            </span>
            <span className="text-xs text-gray-400">
              {showAdvanced ? '收起' : '展开'}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-600" />
                <span className="text-sm">字符分割优化</span>
              </div>
              <Switch
                checked={options.useSegmentation}
                onCheckedChange={(v) => updateOption('useSegmentation', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-600" />
                <span className="text-sm">K-means聚类优化</span>
              </div>
              <Switch
                checked={options.useKMeans}
                onCheckedChange={(v) => updateOption('useKMeans', v)}
              />
            </div>

            {options.useKMeans && (
              <div className="pl-6 space-y-2">
                <span className="text-xs text-gray-500">聚类数量: {options.kMeansClusters}</span>
                <Slider
                  value={[options.kMeansClusters]}
                  onValueChange={([v]) => updateOption('kMeansClusters', v)}
                  min={3}
                  max={30}
                  step={1}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-orange-600" />
                <span className="text-sm">K-近邻分类器</span>
              </div>
              <Switch
                checked={options.useKNN}
                onCheckedChange={(v) => updateOption('useKNN', v)}
              />
            </div>

            {options.useKNN && (
              <div className="pl-6 space-y-2">
                <span className="text-xs text-gray-500">近邻数量: {options.knnNeighbors}</span>
                <Slider
                  value={[options.knnNeighbors]}
                  onValueChange={([v]) => updateOption('knnNeighbors', v)}
                  min={1}
                  max={15}
                  step={1}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-green-600" />
                <span className="text-sm">决策树后处理</span>
              </div>
              <Switch
                checked={options.useDecisionTree}
                onCheckedChange={(v) => updateOption('useDecisionTree', v)}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 提示信息 */}
      {!imageSource && (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 bg-gray-50 rounded-xl">
          <Scan className="w-8 h-8 mb-2 opacity-50" />
          <p>请先上传图片</p>
        </div>
      )}

      {imageSource && !isInitialized && !initError && (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500 bg-blue-50 rounded-xl border border-blue-100">
          <Settings className="w-8 h-8 mb-2 text-blue-500" />
          <p>点击"初始化 OCR"加载识别引擎</p>
          <p className="text-xs text-gray-400 mt-1">首次使用需要下载语言包</p>
        </div>
      )}

      {/* OCR 结果编辑 */}
      {characters.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="recognize" className="gap-2">
              <Scan className="w-4 h-4" />
              识别结果
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-2">
              <Edit3 className="w-4 h-4" />
              手动修正
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recognize" className="mt-0">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-2">
                {characters.map((char) => (
                  <div
                    key={char.id}
                    className="aspect-square flex items-center justify-center bg-white rounded border hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('edit')}
                  >
                    {char.imageData ? (
                      <img
                        src={char.imageData}
                        alt={char.char}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-lg">{char.char}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="mt-0">
            <OCRCanvasEditor
              imageSource={imageSource}
              characters={characters}
              onCharactersChange={onCharactersChange}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
