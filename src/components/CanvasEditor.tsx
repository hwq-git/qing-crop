import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Square,
  Circle,
  Scissors,
  RotateCcw,
  MousePointer,
  Trash2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getOCREngine } from '@/utils/ocrEngine';
import type { CharacterItem } from '@/utils/ocrEngine';

type ToolType = 'select' | 'rect' | 'circle';
type ShapeType = 'rect' | 'circle';

interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

interface CanvasEditorProps {
  imageUrl: string | null;
  imageSource: HTMLImageElement | null;
  onClear: () => void;
  onCharactersAdd: (characters: CharacterItem[]) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageUrl,
  imageSource,
  onClear,
  onCharactersAdd,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);

  // 加载图片
  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setShapes([]);
        setSelectedShapeId(null);
      };
      img.src = imageUrl;
    }
  }, [imageUrl]);

  // 同步外部图片源
  useEffect(() => {
    if (imageSource) {
      setImage(imageSource);
    }
  }, [imageSource]);

  // 初始化画布
  useEffect(() => {
    if (image && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 32;
      const newScale = Math.min(containerWidth / image.width, 1);
      setScale(newScale);

      canvas.width = image.width;
      canvas.height = image.height;
      canvas.style.width = `${image.width * newScale}px`;
      canvas.style.height = `${image.height * newScale}px`;

      drawCanvas();
    }
  }, [image]);

  // 绘制画布
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制图片
    ctx.drawImage(image, 0, 0);

    // 绘制所有形状
    shapes.forEach((shape) => {
      const isSelected = shape.id === selectedShapeId;
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#ef4444';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash(isSelected ? [] : [5, 5]);

      if (shape.type === 'rect') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        // 填充半透明背景
        ctx.fillStyle = isSelected
          ? 'rgba(59, 130, 246, 0.1)'
          : 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === 'circle' && shape.radius) {
        ctx.beginPath();
        ctx.arc(
          shape.x + shape.radius,
          shape.y + shape.radius,
          shape.radius,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.fillStyle = isSelected
          ? 'rgba(59, 130, 246, 0.1)'
          : 'rgba(239, 68, 68, 0.1)';
        ctx.fill();
      }

      // 绘制选中标记
      if (isSelected) {
        ctx.fillStyle = '#3b82f6';
        const handleSize = 6 / scale;
        if (shape.type === 'rect') {
          ctx.fillRect(
            shape.x - handleSize / 2,
            shape.y - handleSize / 2,
            handleSize,
            handleSize
          );
          ctx.fillRect(
            shape.x + shape.width - handleSize / 2,
            shape.y - handleSize / 2,
            handleSize,
            handleSize
          );
          ctx.fillRect(
            shape.x - handleSize / 2,
            shape.y + shape.height - handleSize / 2,
            handleSize,
            handleSize
          );
          ctx.fillRect(
            shape.x + shape.width - handleSize / 2,
            shape.y + shape.height - handleSize / 2,
            handleSize,
            handleSize
          );
        }
      }
    });

    ctx.setLineDash([]);
  }, [image, shapes, selectedShapeId, scale]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // 获取鼠标在画布上的坐标
  const getCanvasCoordinates = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  // 检查点是否在形状内
  const isPointInShape = (x: number, y: number, shape: Shape): boolean => {
    if (shape.type === 'rect') {
      return (
        x >= shape.x &&
        x <= shape.x + shape.width &&
        y >= shape.y &&
        y <= shape.y + shape.height
      );
    } else if (shape.type === 'circle' && shape.radius) {
      const centerX = shape.x + shape.radius;
      const centerY = shape.y + shape.radius;
      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      return distance <= shape.radius;
    }
    return false;
  };

  // 鼠标按下
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!currentTool || currentTool === 'select') {
      const { x, y } = getCanvasCoordinates(e);
      // 查找点击的形状
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (isPointInShape(x, y, shapes[i])) {
          setSelectedShapeId(shapes[i].id);
          return;
        }
      }
      setSelectedShapeId(null);
      return;
    }

    const { x, y } = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPos({ x, y });
  };

  // 鼠标移动
  const handleMouseMove = (_e: React.MouseEvent) => {
    if (!isDrawing || currentTool === 'select') return;
    // 预留：实时预览功能
  };

  // 鼠标松开
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || currentTool === 'select') return;

    const { x, y } = getCanvasCoordinates(e);
    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);

    if (width > 10 && height > 10) {
      const newShape: Shape = {
        id: `shape_${Date.now()}`,
        type: currentTool as ShapeType,
        x: Math.min(startPos.x, x),
        y: Math.min(startPos.y, y),
        width,
        height,
        radius: currentTool === 'circle' ? Math.min(width, height) / 2 : undefined,
      };
      setShapes([...shapes, newShape]);
      setSelectedShapeId(newShape.id);
      toast.success('切割区域已创建');
    }

    setIsDrawing(false);
  };

  // 删除选中形状
  const deleteSelectedShape = () => {
    if (selectedShapeId) {
      setShapes(shapes.filter((s) => s.id !== selectedShapeId));
      setSelectedShapeId(null);
      toast.success('已删除');
    }
  };

  // 清空所有形状
  const clearAllShapes = () => {
    setShapes([]);
    setSelectedShapeId(null);
    toast.success('已清空所有区域');
  };

  // 执行切割并下载
  const performCut = () => {
    if (shapes.length === 0) {
      toast.error('请先创建切割区域');
      return;
    }

    if (!image) {
      toast.error('图片未加载');
      return;
    }

    shapes.forEach((shape, index) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (shape.type === 'rect') {
        canvas.width = shape.width;
        canvas.height = shape.height;
        ctx.drawImage(
          image,
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          0,
          0,
          shape.width,
          shape.height
        );
      } else if (shape.type === 'circle' && shape.radius) {
        const size = shape.radius * 2;
        canvas.width = size;
        canvas.height = size;
        ctx.beginPath();
        ctx.arc(shape.radius, shape.radius, shape.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          image,
          shape.x,
          shape.y,
          size,
          size,
          0,
          0,
          size,
          size
        );
      }

      // 下载
      const link = document.createElement('a');
      link.download = `cut_${index + 1}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });

    toast.success(`已切割并下载 ${shapes.length} 个区域`);
  };

  // 添加到字符库
  const addToCharacterLibrary = () => {
    if (shapes.length === 0) {
      toast.error('请先创建切割区域');
      return;
    }

    if (!image) {
      toast.error('图片未加载');
      return;
    }

    const engine = getOCREngine();
    const characters: CharacterItem[] = [];

    shapes.forEach((shape) => {
      const char = engine.createCharacterFromCut(
        image,
        {
          x: shape.x,
          y: shape.y,
          width: shape.type === 'circle' && shape.radius ? shape.radius * 2 : shape.width,
          height: shape.type === 'circle' && shape.radius ? shape.radius * 2 : shape.height,
        },
        shape.id
      );
      characters.push(char);
    });

    onCharactersAdd(characters);
    toast.success(`已添加 ${characters.length} 个字符到字符库`);
  };

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-gray-400">请先上传图片</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm">
          <Button
            variant={currentTool === 'select' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentTool('select')}
            className="gap-1"
          >
            <MousePointer className="w-4 h-4" />
            选择
          </Button>
          <Button
            variant={currentTool === 'rect' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentTool('rect')}
            className="gap-1"
          >
            <Square className="w-4 h-4" />
            矩形
          </Button>
          <Button
            variant={currentTool === 'circle' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentTool('circle')}
            className="gap-1"
          >
            <Circle className="w-4 h-4" />
            圆形
          </Button>
        </div>

        <div className="w-px h-8 bg-gray-300 mx-2" />

        <Button
          variant="outline"
          size="sm"
          onClick={deleteSelectedShape}
          disabled={!selectedShapeId}
          className="gap-1"
        >
          <Trash2 className="w-4 h-4" />
          删除
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={clearAllShapes}
          disabled={shapes.length === 0}
          className="gap-1"
        >
          <RotateCcw className="w-4 h-4" />
          清空
        </Button>

        <div className="flex-1" />

        <Button
          variant="default"
          size="sm"
          onClick={addToCharacterLibrary}
          disabled={shapes.length === 0}
          className="gap-1 bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          添加到字符库
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={performCut}
          disabled={shapes.length === 0}
          className="gap-1 bg-green-600 hover:bg-green-700"
        >
          <Scissors className="w-4 h-4" />
          切割下载
        </Button>

        <Button variant="outline" size="sm" onClick={onClear} className="gap-1">
          重新上传
        </Button>
      </div>

      {/* 画布区域 */}
      <div
        ref={containerRef}
        className="overflow-auto bg-gray-100 rounded-xl p-4 flex justify-center"
        style={{ maxHeight: '500px' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`bg-white shadow-lg ${
            currentTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        />
      </div>

      {/* 状态栏 */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          已创建 {shapes.length} 个切割区域
          {selectedShapeId && ' (已选中1个)'}
        </span>
        <span>
          {currentTool === 'select' && '选择模式：点击选中区域'}
          {currentTool === 'rect' && '矩形模式：拖拽绘制矩形'}
          {currentTool === 'circle' && '圆形模式：拖拽绘制圆形'}
        </span>
      </div>
    </div>
  );
};
