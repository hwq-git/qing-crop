// 剪贴板接力面板 - 对接外部OCR
import React, { useState, useEffect } from 'react';
import { ClipboardPaste, X, Info, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getClipboardManager } from '@/utils/clipboardManager';
import type { CharacterItem } from '@/utils/ocrEngine';

interface ClipboardPanelProps {
  characters: CharacterItem[];
  selectedId: string | null;
  onCharactersChange: (characters: CharacterItem[]) => void;
}

export const ClipboardPanel: React.FC<ClipboardPanelProps> = ({
  characters,
  selectedId,
  onCharactersChange,
}) => {
  const [clipboardText, setClipboardText] = useState<string>('');
  const [showPanel, setShowPanel] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [matchedChars, setMatchedChars] = useState<CharacterItem[]>([]);

  // 检查剪贴板权限
  const checkPermission = async () => {
    const clipboard = getClipboardManager();
    const permitted = await clipboard.checkPermission();
    setHasPermission(permitted);
    return permitted;
  };

  // 读取剪贴板
  const readClipboard = async () => {
    const clipboard = getClipboardManager();
    
    // 首次使用请求权限
    if (hasPermission === null) {
      const permitted = await checkPermission();
      if (!permitted) {
        toast.error('需要剪贴板权限才能使用此功能');
        return;
      }
    }

    const text = await clipboard.readText();
    if (text) {
      setClipboardText(text);
      setShowPanel(true);
      
      // 智能匹配
      const matched = smartMatch(text, characters);
      setMatchedChars(matched);
      
      if (matched.length > 0) {
        toast.success(`从剪贴板读取 ${text.length} 个字符，匹配到 ${matched.length} 个区域`);
      } else {
        toast.info('已读取剪贴板内容，但未找到匹配区域');
      }
    } else {
      toast.info('剪贴板为空');
    }
  };

  // 智能匹配算法
  const smartMatch = (text: string, chars: CharacterItem[]): CharacterItem[] => {
    const matched: CharacterItem[] = [];
    
    // 清理文本
    const cleanedText = text.trim().replace(/\s+/g, '');
    
    if (cleanedText.length === 0) return matched;

    // 策略1: 如果只有一个字符框被选中，直接将整个文本填入
    if (selectedId) {
      const selectedChar = chars.find(c => c.id === selectedId);
      if (selectedChar) {
        return [selectedChar];
      }
    }

    // 策略2: 根据文本长度匹配连续的字符框
    // 按位置排序字符框
    const sortedChars = [...chars].sort((a, b) => {
      // 先按y排序（行优先）
      if (Math.abs(a.bbox.y - b.bbox.y) > 20) {
        return a.bbox.y - b.bbox.y;
      }
      // 同行按x排序
      return a.bbox.x - b.bbox.x;
    });

    // 尝试匹配前N个字符框
    const matchCount = Math.min(cleanedText.length, sortedChars.length);
    for (let i = 0; i < matchCount; i++) {
      matched.push(sortedChars[i]);
    }

    return matched;
  };

  // 应用剪贴板内容到字符
  const applyToCharacter = (charId: string, charIndex: number) => {
    const cleanedText = clipboardText.trim().replace(/\s+/g, '');
    const char = cleanedText[charIndex] || '';
    
    if (char) {
      onCharactersChange(
        characters.map(c => 
          c.id === charId ? { ...c, char } : c
        )
      );
      toast.success(`已设置字符: ${char}`);
    }
  };

  // 应用到所有匹配
  const applyToAll = () => {
    const cleanedText = clipboardText.trim().replace(/\s+/g, '');
    
    if (matchedChars.length === 0) {
      toast.error('没有匹配的字符框');
      return;
    }

    const newChars = [...characters];
    let appliedCount = 0;

    matchedChars.forEach((matchedChar, index) => {
      const char = cleanedText[index];
      if (char) {
        const charIndex = newChars.findIndex(c => c.id === matchedChar.id);
        if (charIndex !== -1) {
          newChars[charIndex] = { ...newChars[charIndex], char };
          appliedCount++;
        }
      }
    });

    onCharactersChange(newChars);
    toast.success(`已应用 ${appliedCount} 个字符`);
    setShowPanel(false);
  };

  // 监听全局粘贴事件
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // 如果在输入框中，不处理
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      e.preventDefault();
      
      const text = e.clipboardData?.getData('text');
      if (text) {
        setClipboardText(text);
        setShowPanel(true);
        
        const matched = smartMatch(text, characters);
        setMatchedChars(matched);
        
        if (matched.length > 0) {
          toast.success(`粘贴 ${text.length} 个字符，匹配 ${matched.length} 个区域`);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [characters, selectedId]);

  // 初始检查权限
  useEffect(() => {
    checkPermission();
  }, []);

  if (!showPanel) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={readClipboard}
          className="gap-1"
        >
          <ClipboardPaste className="w-4 h-4" />
          读取剪贴板
        </Button>
        <span className="text-xs text-gray-400">
          或使用 Ctrl+V 粘贴
        </span>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-blue-900">剪贴板内容</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setShowPanel(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* 剪贴板内容显示 */}
      <div className="bg-white rounded p-3 border">
        <p className="text-lg font-mono tracking-wider">{clipboardText}</p>
        <p className="text-xs text-gray-400 mt-1">
          共 {clipboardText.length} 个字符
        </p>
      </div>

      {/* 匹配结果 */}
      {matchedChars.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-blue-700">
            匹配到 {matchedChars.length} 个字符框：
          </p>
          <div className="grid grid-cols-8 gap-2">
            {matchedChars.map((char, index) => {
              const clipboardChar = clipboardText.trim().replace(/\s+/g, '')[index];
              return (
                <button
                  key={char.id}
                  onClick={() => applyToCharacter(char.id, index)}
                  className="aspect-square flex flex-col items-center justify-center bg-white rounded border hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  title={`应用到位置 ${index + 1}`}
                >
                  {char.imageData ? (
                    <img
                      src={char.imageData}
                      alt={char.char}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-sm">{char.char}</span>
                  )}
                  {clipboardChar && (
                    <span className="text-xs text-blue-600 font-bold">
                      → {clipboardChar}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={applyToAll}
          disabled={matchedChars.length === 0}
          className="gap-1"
        >
          <Check className="w-4 h-4" />
          应用到全部
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={readClipboard}
          className="gap-1"
        >
          <ClipboardPaste className="w-4 h-4" />
          重新读取
        </Button>
      </div>

      {/* 提示 */}
      <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-100/50 p-2 rounded">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          提示：使用微信/QQ截图OCR后，直接按 Ctrl+V 即可粘贴识别结果。
          点击上方字符框可单独应用，或点击"应用到全部"批量填充。
        </p>
      </div>
    </div>
  );
};
