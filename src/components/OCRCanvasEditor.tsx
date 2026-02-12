import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  Plus,
  Scan,
  Check,
  X,
  Move,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { CharacterItem } from '@/utils/ocrEngine';

interface OCRCanvasEditorProps {
  imageSource: HTMLImageElement | null;
  characters: CharacterItem[];
  onCharactersChange: (characters: CharacterItem[]) => void;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

export const OCRCanvasEditor: React.FC<OCRCanvasEditorProps> = ({
  imageSource,
  characters,
  onCharactersChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const charactersRef = useRef<CharacterItem[]>(characters);
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle>(null);

  // 同步 ref 和 state
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  // 初始化画布
  useEffect(() => {
    if (imageSource && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 32;
      const newScale = Math.min(containerWidth / imageSource.width, 1);
      setScale(newScale);

      canvas.width = imageSource.width;
      canvas.height = imageSource.height;
      canvas.style.width = `${imageSource.width * newScale}px`;
      canvas.style.height = `${imageSource.height * newScale}px`;

      drawCanvas();
    }
  }, [imageSource, characters]);

  // 绘制画布
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageSource) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制图片
    ctx.drawImage(imageSource, 0, 0);

    // 绘制所有字符框
    characters.forEach((char) => {
      const isSelected = char.id === selectedId;
      const isEditing = char.id === editingId;

      // 绘制边框
      ctx.strokeStyle = isSelected ? '#3b82f6' : isEditing ? '#10b981' : '#ef4444';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([]);
      ctx.strokeRect(char.bbox.x, char.bbox.y, char.bbox.width, char.bbox.height);

      // 填充背景
      ctx.fillStyle = isSelected
        ? 'rgba(59, 130, 246, 0.15)'
        : isEditing
        ? 'rgba(16, 185, 129, 0.15)'
        : 'rgba(239, 68, 68, 0.1)';
      ctx.fillRect(char.bbox.x, char.bbox.y, char.bbox.width, char.bbox.height);

      // 绘制字符标签
      ctx.fillStyle = isSelected ? '#3b82f6' : isEditing ? '#10b981' : '#ef4444';
      ctx.font = `bold ${Math.max(14 / scale, 12)}px sans-serif`;
      ctx.fillText(
        char.char,
        char.bbox.x,
        char.bbox.y - 6 / scale
      );

      // 绘制调整大小的手柄（只在选中时显示）
      if (isSelected || isEditing) {
        const handleSize = 8 / scale;
        const halfHandle = handleSize / 2;
        ctx.fillStyle = isEditing ? '#10b981' : '#3b82f6';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1 / scale;

        // 四个角的手柄
        const corners = [
          { x: char.bbox.x, y: char.bbox.y, handle: 'nw' },
          { x: char.bbox.x + char.bbox.width, y: char.bbox.y, handle: 'ne' },
          { x: char.bbox.x, y: char.bbox.y + char.bbox.height, handle: 'sw' },
          { x: char.bbox.x + char.bbox.width, y: char.bbox.y + char.bbox.height, handle: 'se' },
        ];

        corners.forEach(({ x, y, handle }) => {
          const isHovered = hoveredHandle === handle;
          ctx.fillStyle = isHovered ? '#f59e0b' : isEditing ? '#10b981' : '#3b82f6';
          ctx.fillRect(x - halfHandle, y - halfHandle, handleSize, handleSize);
          ctx.strokeRect(x - halfHandle, y - halfHandle, handleSize, handleSize);
        });

        // 四条边的中点手柄
        const edges = [
          { x: char.bbox.x + char.bbox.width / 2, y: char.bbox.y, handle: 'n' },
          { x: char.bbox.x + char.bbox.width / 2, y: char.bbox.y + char.bbox.height, handle: 's' },
          { x: char.bbox.x, y: char.bbox.y + char.bbox.height / 2, handle: 'w' },
          { x: char.bbox.x + char.bbox.width, y: char.bbox.y + char.bbox.height / 2, handle: 'e' },
        ];

        edges.forEach(({ x, y, handle }) => {
          const isHovered = hoveredHandle === handle;
          ctx.fillStyle = isHovered ? '#f59e0b' : isEditing ? '#10b981' : '#3b82f6';
          ctx.beginPath();
          ctx.arc(x, y, halfHandle, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    });
  }, [imageSource, characters, selectedId, editingId, scale, hoveredHandle]);

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

  // 检查点是否在字符框内
  const isPointInChar = (x: number, y: number, char: CharacterItem): boolean => {
    return (
      x >= char.bbox.x &&
      x <= char.bbox.x + char.bbox.width &&
      y >= char.bbox.y &&
      y <= char.bbox.y + char.bbox.height
    );
  };

  // 获取调整大小的手柄
  const getResizeHandle = (x: number, y: number, char: CharacterItem): ResizeHandle => {
    const handleSize = 12 / scale;
    const halfHandle = handleSize / 2;

    // 检查四个角
    if (Math.abs(x - char.bbox.x) < halfHandle && Math.abs(y - char.bbox.y) < halfHandle) return 'nw';
    if (Math.abs(x - (char.bbox.x + char.bbox.width)) < halfHandle && Math.abs(y - char.bbox.y) < halfHandle) return 'ne';
    if (Math.abs(x - char.bbox.x) < halfHandle && Math.abs(y - (char.bbox.y + char.bbox.height)) < halfHandle) return 'sw';
    if (Math.abs(x - (char.bbox.x + char.bbox.width)) < halfHandle && Math.abs(y - (char.bbox.y + char.bbox.height)) < halfHandle) return 'se';

    // 检查四条边
    if (Math.abs(y - char.bbox.y) < halfHandle && x > char.bbox.x && x < char.bbox.x + char.bbox.width) return 'n';
    if (Math.abs(y - (char.bbox.y + char.bbox.height)) < halfHandle && x > char.bbox.x && x < char.bbox.x + char.bbox.width) return 's';
    if (Math.abs(x - char.bbox.x) < halfHandle && y > char.bbox.y && y < char.bbox.y + char.bbox.height) return 'w';
    if (Math.abs(x - (char.bbox.x + char.bbox.width)) < halfHandle && y > char.bbox.y && y < char.bbox.y + char.bbox.height) return 'e';

    return null;
  };

  // 鼠标按下
  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoordinates(e);

    // 如果已选中字符，先检查是否点击了调整大小的手柄
    if (selectedId) {
      const selectedChar = characters.find((c) => c.id === selectedId);
      if (selectedChar) {
        const handle = getResizeHandle(x, y, selectedChar);
        if (handle) {
          setIsResizing(true);
          setResizeHandle(handle);
          return;
        }
      }
    }

    // 查找点击的字符
    for (let i = characters.length - 1; i >= 0; i--) {
      if (isPointInChar(x, y, characters[i])) {
        setSelectedId(characters[i].id);
        setIsDragging(true);
        setDragStart({ x: x - characters[i].bbox.x, y: y - characters[i].bbox.y });
        return;
      }
    }

    setSelectedId(null);
    setHoveredHandle(null);
  };

  // 鼠标移动
  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoordinates(e);

    // 调整大小
    if (isResizing && selectedId && resizeHandle) {
      const char = characters.find((c) => c.id === selectedId);
      if (!char) return;

      let newX = char.bbox.x;
      let newY = char.bbox.y;
      let newWidth = char.bbox.width;
      let newHeight = char.bbox.height;

      const minSize = 10;

      switch (resizeHandle) {
        case 'e':
          newWidth = Math.max(minSize, x - char.bbox.x);
          break;
        case 'w':
          newWidth = Math.max(minSize, char.bbox.x + char.bbox.width - x);
          newX = Math.min(x, char.bbox.x + char.bbox.width - minSize);
          break;
        case 's':
          newHeight = Math.max(minSize, y - char.bbox.y);
          break;
        case 'n':
          newHeight = Math.max(minSize, char.bbox.y + char.bbox.height - y);
          newY = Math.min(y, char.bbox.y + char.bbox.height - minSize);
          break;
        case 'se':
          newWidth = Math.max(minSize, x - char.bbox.x);
          newHeight = Math.max(minSize, y - char.bbox.y);
          break;
        case 'sw':
          newWidth = Math.max(minSize, char.bbox.x + char.bbox.width - x);
          newX = Math.min(x, char.bbox.x + char.bbox.width - minSize);
          newHeight = Math.max(minSize, y - char.bbox.y);
          break;
        case 'ne':
          newWidth = Math.max(minSize, x - char.bbox.x);
          newHeight = Math.max(minSize, char.bbox.y + char.bbox.height - y);
          newY = Math.min(y, char.bbox.y + char.bbox.height - minSize);
          break;
        case 'nw':
          newWidth = Math.max(minSize, char.bbox.x + char.bbox.width - x);
          newX = Math.min(x, char.bbox.x + char.bbox.width - minSize);
          newHeight = Math.max(minSize, char.bbox.y + char.bbox.height - y);
          newY = Math.min(y, char.bbox.y + char.bbox.height - minSize);
          break;
      }

      const updatedChars = characters.map((c) =>
        c.id === selectedId
          ? { ...c, bbox: { ...c.bbox, x: newX, y: newY, width: newWidth, height: newHeight } }
          : c
      );
      onCharactersChange(updatedChars);
      return;
    }

    // 移动
    if (isDragging && selectedId) {
      const char = characters.find((c) => c.id === selectedId);
      if (!char) return;

      const newX = x - dragStart.x;
      const newY = y - dragStart.y;

      const updatedChars = characters.map((c) =>
        c.id === selectedId
          ? { ...c, bbox: { ...c.bbox, x: newX, y: newY } }
          : c
      );
      onCharactersChange(updatedChars);
      return;
    }

    // 悬停检测 - 显示调整大小的光标
    if (selectedId) {
      const selectedChar = characters.find((c) => c.id === selectedId);
      if (selectedChar) {
        const handle = getResizeHandle(x, y, selectedChar);
        setHoveredHandle(handle);
      }
    }
  };

  // 提取字符框位置的图片
  const extractCharImage = (char: CharacterItem): string => {
    if (!imageSource) return '';
    
    const canvas = document.createElement('canvas');
    const width = Math.max(1, Math.ceil(char.bbox.width));
    const height = Math.max(1, Math.ceil(char.bbox.height));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        imageSource,
        char.bbox.x,
        char.bbox.y,
        char.bbox.width,
        char.bbox.height,
        0,
        0,
        width,
        height
      );
      return canvas.toDataURL('image/png');
    }
    return '';
  };

  // 鼠标松开
  const handleMouseUp = () => {
    // 如果刚完成拖拽或调整大小，重新提取图片
    if ((isDragging || isResizing) && selectedId && imageSource) {
      // 从 ref 中获取最新的字符数据
      const updatedChar = charactersRef.current.find((c) => c.id === selectedId);
      if (updatedChar) {
        const newImageData = extractCharImage(updatedChar);
        if (newImageData) {
          onCharactersChange(
            charactersRef.current.map((c) =>
              c.id === selectedId ? { ...c, imageData: newImageData } : c
            )
          );
        }
      }
    }
    
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  // 获取光标样式
  const getCursorStyle = (): string => {
    if (isDragging) return 'grabbing';
    if (isResizing) {
      switch (resizeHandle) {
        case 'n':
        case 's':
          return 'ns-resize';
        case 'e':
        case 'w':
          return 'ew-resize';
        case 'ne':
        case 'sw':
          return 'nesw-resize';
        case 'nw':
        case 'se':
          return 'nwse-resize';
      }
    }
    if (hoveredHandle) {
      switch (hoveredHandle) {
        case 'n':
        case 's':
          return 'ns-resize';
        case 'e':
        case 'w':
          return 'ew-resize';
        case 'ne':
        case 'sw':
          return 'nesw-resize';
        case 'nw':
        case 'se':
          return 'nwse-resize';
      }
    }
    if (selectedId) return 'grab';
    return 'default';
  };

  // 删除选中字符
  const deleteSelectedChar = () => {
    if (selectedId) {
      onCharactersChange(characters.filter((c) => c.id !== selectedId));
      setSelectedId(null);
      toast.success('已删除');
    }
  };

  // 清空所有字符
  const clearAllChars = () => {
    onCharactersChange([]);
    setSelectedId(null);
    toast.success('已清空所有字符');
  };

  // 开始编辑字符
  const startEdit = () => {
    if (selectedId) {
      const char = characters.find((c) => c.id === selectedId);
      if (char) {
        setEditingId(selectedId);
        setEditValue(char.char);
      }
    }
  };

  // 保存编辑
  const saveEdit = () => {
    if (editingId) {
      onCharactersChange(
        characters.map((c) => (c.id === editingId ? { ...c, char: editValue } : c))
      );
      setEditingId(null);
      setSelectedId(null);
      toast.success('已保存');
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  // 添加新字符框
  const addNewChar = () => {
    if (!imageSource) return;

    const newChar: CharacterItem = {
      id: `manual_${Date.now()}`,
      char: '新',
      bbox: { x: 50, y: 50, width: 40, height: 40 },
      confidence: 100,
      imageData: '',
      source: 'manual',
    };

    // 提取图片
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(imageSource, 50, 50, 40, 40, 0, 0, 40, 40);
      newChar.imageData = canvas.toDataURL('image/png');
    }

    onCharactersChange([...characters, newChar]);
    setSelectedId(newChar.id);
    toast.success('已添加新字符框');
  };

  if (!imageSource) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-gray-400">请先上传图片</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={addNewChar} className="gap-1">
            <Plus className="w-4 h-4" />
            添加字符框
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={deleteSelectedChar}
            disabled={!selectedId}
            className="gap-1"
          >
            <Trash2 className="w-4 h-4" />
            删除选中
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearAllChars}
            disabled={characters.length === 0}
            className="gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            清空
          </Button>
        </div>

        <div className="w-px h-8 bg-gray-300 mx-2" />

        {editingId ? (
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 w-24"
              autoFocus
              maxLength={1}
            />
            <Button size="sm" variant="default" onClick={saveEdit} className="h-8 px-2">
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8 px-2">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={startEdit}
            disabled={!selectedId}
            className="gap-1"
          >
            <Scan className="w-4 h-4" />
            修改字符
          </Button>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Move className="w-4 h-4" />
            拖拽移动
          </span>
          <span className="flex items-center gap-1">
            <Maximize2 className="w-4 h-4" />
            拖拽边角调整大小
          </span>
        </div>

        <div className="w-px h-8 bg-gray-300 mx-2" />

        <div className="text-sm text-gray-500">
          共 {characters.length} 个字符
          {selectedId && ' (已选中1个)'}
        </div>
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
          style={{ cursor: getCursorStyle() }}
          className="bg-white shadow-lg"
        />
      </div>

      {/* 提示 */}
      <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded-sm" />
            未选中
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-blue-500 rounded-sm" />
            已选中
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded-sm" />
            编辑中
          </span>
        </div>
        <span>点击选中，拖拽移动，拖拽边角调整大小</span>
      </div>
    </div>
  );
};
