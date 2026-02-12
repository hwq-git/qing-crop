import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Grid3X3,
  List,
  Download,
  FolderOpen,
  Search,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { toast } from 'sonner';
import type { CharacterItem } from '@/utils/ocrEngine';
import { CharacterClassifier } from '@/utils/characterClassifier';

interface CharacterManagerProps {
  characters: CharacterItem[];
  onCharactersChange: (characters: CharacterItem[]) => void;
  imageSource: HTMLImageElement | null;
}

export const CharacterManager: React.FC<CharacterManagerProps> = ({
  characters,
  onCharactersChange,
  imageSource,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'grouped'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 归类数据
  const groupedChars = useMemo(() => {
    return CharacterClassifier.classify(characters);
  }, [characters]);

  // 过滤后的字符
  const filteredChars = useMemo(() => {
    if (!searchTerm) return characters;
    return characters.filter(c => 
      c.char.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [characters, searchTerm]);

  // 添加新字符
  const handleAddChar = () => {
    if (!imageSource) {
      toast.error('请先上传图片');
      return;
    }

    const newChar: CharacterItem = {
      id: `manual_${Date.now()}`,
      char: '新字符',
      bbox: { x: 50, y: 50, width: 50, height: 50 },
      confidence: 100,
      imageData: '',
      source: 'manual',
    };

    // 创建默认图片
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 50, 50);
      ctx.strokeStyle = '#999';
      ctx.strokeRect(0, 0, 50, 50);
      newChar.imageData = canvas.toDataURL('image/png');
    }

    onCharactersChange([...characters, newChar]);
    toast.success('已添加新字符');
  };

  // 删除字符
  const handleDeleteChar = (id: string) => {
    onCharactersChange(characters.filter(c => c.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success('已删除');
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) {
      toast.error('请先选择字符');
      return;
    }
    onCharactersChange(characters.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    toast.success(`已删除 ${selectedIds.size} 个字符`);
  };

  // 开始编辑
  const handleStartEdit = (char: CharacterItem) => {
    setEditingId(char.id);
    setEditValue(char.char);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (editingId) {
      onCharactersChange(
        characters.map(c =>
          c.id === editingId ? { ...c, char: editValue } : c
        )
      );
      setEditingId(null);
      toast.success('已保存');
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  // 切换选择
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 全选
  const selectAll = () => {
    if (selectedIds.size === filteredChars.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredChars.map(c => c.id)));
    }
  };

  // 导出字符
  const handleExport = () => {
    if (characters.length === 0) {
      toast.error('没有可导出的字符');
      return;
    }

    const exportData = {
      characters: characters.map(c => ({
        char: c.char,
        bbox: c.bbox,
        confidence: c.confidence,
        source: c.source,
      })),
      grouped: groupedChars.map(g => ({
        char: g.char,
        count: g.count,
      })),
      exportTime: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `characters_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('导出成功');
  };

  // 导出图片
  const handleExportImages = () => {
    if (characters.length === 0) {
      toast.error('没有可导出的字符');
      return;
    }

    // 按归类分组导出
    groupedChars.forEach(group => {
      group.items.forEach((item, index) => {
        if (item.imageData) {
          const link = document.createElement('a');
          link.download = `char_${group.char}_${index + 1}.png`;
          link.href = item.imageData;
          link.click();
        }
      });
    });

    toast.success(`已导出 ${characters.length} 个字符图片`);
  };

  // 渲染网格视图
  const renderGridView = () => (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
      {filteredChars.map(char => (
        <div
          key={char.id}
          className={`relative group border rounded-lg p-2 cursor-pointer transition-all ${
            selectedIds.has(char.id)
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => toggleSelection(char.id)}
        >
          <div className="aspect-square flex items-center justify-center bg-gray-50 rounded mb-2 overflow-hidden">
            {char.imageData ? (
              <img
                src={char.imageData}
                alt={char.char}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <span className="text-2xl">{char.char}</span>
            )}
          </div>
          <div className="text-center">
            {editingId === char.id ? (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="h-6 text-xs"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
                  <Check className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-medium truncate">{char.char}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => {
                    e.stopPropagation();
                    handleStartEdit(char);
                  }}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 text-red-500 hover:text-red-600"
              onClick={e => {
                e.stopPropagation();
                handleDeleteChar(char.id);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  // 渲染列表视图
  const renderListView = () => (
    <div className="space-y-2">
      {filteredChars.map(char => (
        <div
          key={char.id}
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
            selectedIds.has(char.id)
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => toggleSelection(char.id)}
        >
          <div className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded overflow-hidden flex-shrink-0">
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
          <div className="flex-1 min-w-0">
            {editingId === char.id ? (
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="h-8"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancelEdit}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <p className="font-medium flex items-center gap-2">
                  {char.char}
                  <Badge 
                    variant={char.source === 'ocr' ? 'default' : 'secondary'} 
                    className="text-xs"
                  >
                    {char.source === 'ocr' ? 'OCR' : '手动'}
                  </Badge>
                </p>
                <p className="text-xs text-gray-500">
                  位置: ({Math.round(char.bbox.x)}, {Math.round(char.bbox.y)}) | 
                  置信度: {char.confidence.toFixed(1)}%
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={e => {
                e.stopPropagation();
                handleStartEdit(char);
              }}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-500 hover:text-red-600"
              onClick={e => {
                e.stopPropagation();
                handleDeleteChar(char.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  // 渲染归类视图
  const renderGroupedView = () => (
    <div className="space-y-4">
      {groupedChars.map(group => (
        <div key={group.char} className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {group.char}
              </Badge>
              <span className="text-sm text-gray-500">
                共 {group.count} 个
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // 导出该组的所有图片
                group.items.forEach((item, index) => {
                  if (item.imageData) {
                    const link = document.createElement('a');
                    link.download = `char_${group.char}_${index + 1}.png`;
                    link.href = item.imageData;
                    link.click();
                  }
                });
                toast.success(`已导出 "${group.char}" 的 ${group.count} 个图片`);
              }}
            >
              <Download className="w-4 h-4 mr-1" />
              导出
            </Button>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-2">
            {group.items.map(item => (
              <div
                key={item.id}
                className="aspect-square flex items-center justify-center bg-gray-50 rounded overflow-hidden"
              >
                {item.imageData && (
                  <img
                    src={item.imageData}
                    alt={group.char}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={handleAddChar} className="gap-1">
            <Plus className="w-4 h-4" />
            添加字符
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBatchDelete}
            disabled={selectedIds.size === 0}
            className="gap-1"
          >
            <Trash2 className="w-4 h-4" />
            删除选中 ({selectedIds.size})
          </Button>
        </div>

        <div className="w-px h-8 bg-gray-300 mx-2" />

        <div className="flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm">
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            onClick={() => setViewMode('grid')}
            className="gap-1"
          >
            <Grid3X3 className="w-4 h-4" />
            网格
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            onClick={() => setViewMode('list')}
            className="gap-1"
          >
            <List className="w-4 h-4" />
            列表
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'grouped' ? 'default' : 'ghost'}
            onClick={() => setViewMode('grouped')}
            className="gap-1"
          >
            <FolderOpen className="w-4 h-4" />
            归类 ({groupedChars.length})
          </Button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="搜索字符..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 w-40"
            />
          </div>
          <Button size="sm" variant="outline" onClick={selectAll}>
            {selectedIds.size === filteredChars.length && filteredChars.length > 0
              ? '取消全选'
              : '全选'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1">
            <Tag className="w-4 h-4" />
            导出JSON
          </Button>
          <Button size="sm" variant="default" onClick={handleExportImages} className="gap-1">
            <Download className="w-4 h-4" />
            导出图片
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center gap-4 text-sm text-gray-500 px-1">
        <span>共 {characters.length} 个字符</span>
        <span>已选择 {selectedIds.size} 个</span>
        <span>归类为 {groupedChars.length} 种</span>
      </div>

      {/* 内容区域 */}
      <div className="min-h-[300px] max-h-[500px] overflow-auto">
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Tag className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无字符</p>
            <p className="text-sm">点击"OCR识别"或"添加字符"开始</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' && renderGridView()}
            {viewMode === 'list' && renderListView()}
            {viewMode === 'grouped' && renderGroupedView()}
          </>
        )}
      </div>
    </div>
  );
};
