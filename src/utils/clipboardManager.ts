// 剪贴板管理器 - 支持读取外部OCR结果
import { toast } from 'sonner';
import type { CharacterItem } from './ocrEngine';

export interface ClipboardMatchResult {
  char: CharacterItem;
  matchedText: string;
  confidence: number;
}

class ClipboardManager {
  private lastText: string = '';
  private lastReadTime: number = 0;

  // 读取剪贴板文本
  async readText(): Promise<string | null> {
    try {
      // 检查是否支持剪贴板API
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        toast.error('您的浏览器不支持剪贴板API，请使用 Chrome/Edge 浏览器');
        return null;
      }

      // 请求剪贴板权限
      const text = await navigator.clipboard.readText();
      
      // 避免重复读取相同内容（5秒内）
      const now = Date.now();
      if (text === this.lastText && now - this.lastReadTime < 5000) {
        return this.lastText;
      }
      
      this.lastText = text;
      this.lastReadTime = now;
      return text;
    } catch (error) {
      console.error('Read clipboard failed:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.error('无法访问剪贴板，请点击页面后重试，或按 Ctrl+V 粘贴');
      }
      return null;
    }
  }

  // 写入剪贴板
  async writeText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Write clipboard failed:', error);
      return false;
    }
  }

  // 智能匹配剪贴板内容到字符框
  smartMatch(
    text: string, 
    characters: CharacterItem[],
    selectedId?: string | null
  ): ClipboardMatchResult[] {
    // 清理文本
    const cleanedText = text.trim().replace(/\s+/g, '');
    
    if (cleanedText.length === 0 || characters.length === 0) {
      return [];
    }

    const results: ClipboardMatchResult[] = [];

    // 策略1: 如果只有一个字符框被选中，直接将整个文本填入该框
    if (selectedId) {
      const selectedChar = characters.find(c => c.id === selectedId);
      if (selectedChar) {
        results.push({
          char: selectedChar,
          matchedText: cleanedText,
          confidence: 1,
        });
        return results;
      }
    }

    // 策略2: 按位置排序字符框，依次匹配
    const sortedChars = this.sortByReadingOrder(characters);
    
    // 计算匹配数量
    const matchCount = Math.min(cleanedText.length, sortedChars.length);
    
    for (let i = 0; i < matchCount; i++) {
      results.push({
        char: sortedChars[i],
        matchedText: cleanedText[i],
        confidence: 1,
      });
    }

    return results;
  }

  // 按阅读顺序排序字符（从左到右，从上到下）
  private sortByReadingOrder(characters: CharacterItem[]): CharacterItem[] {
    return [...characters].sort((a, b) => {
      // 先按y排序（行优先），使用容差判断
      const yDiff = a.bbox.y - b.bbox.y;
      if (Math.abs(yDiff) > 20) {
        return yDiff;
      }
      // 同行按x排序
      return a.bbox.x - b.bbox.x;
    });
  }

  // 按阅读顺序排序字符（竖排：从上到下，从右到左）
  private sortByVerticalOrder(characters: CharacterItem[]): CharacterItem[] {
    return [...characters].sort((a, b) => {
      // 先按x排序（列优先，从右到左），使用容差判断
      const xDiff = b.bbox.x - a.bbox.x; // 从右到左
      if (Math.abs(xDiff) > 20) {
        return xDiff;
      }
      // 同列按y排序（从上到下）
      return a.bbox.y - b.bbox.y;
    });
  }

  // 智能匹配（支持竖排）
  smartMatchWithDirection(
    text: string,
    characters: CharacterItem[],
    isVertical: boolean = false,
    selectedId?: string | null
  ): ClipboardMatchResult[] {
    const cleanedText = text.trim().replace(/\s+/g, '');
    
    if (cleanedText.length === 0 || characters.length === 0) {
      return [];
    }

    const results: ClipboardMatchResult[] = [];

    // 如果选中单个字符框
    if (selectedId) {
      const selectedChar = characters.find(c => c.id === selectedId);
      if (selectedChar) {
        results.push({
          char: selectedChar,
          matchedText: cleanedText,
          confidence: 1,
        });
        return results;
      }
    }

    // 根据方向排序
    const sortedChars = isVertical 
      ? this.sortByVerticalOrder(characters)
      : this.sortByReadingOrder(characters);

    const matchCount = Math.min(cleanedText.length, sortedChars.length);
    
    for (let i = 0; i < matchCount; i++) {
      results.push({
        char: sortedChars[i],
        matchedText: cleanedText[i],
        confidence: 1,
      });
    }

    return results;
  }

  // 检查剪贴板权限
  async checkPermission(): Promise<boolean> {
    try {
      // @ts-ignore
      const result = await navigator.permissions.query({ name: 'clipboard-read' });
      return result.state === 'granted' || result.state === 'prompt';
    } catch {
      // 如果不支持权限API，假设可以使用
      return true;
    }
  }

  // 请求剪贴板权限
  async requestPermission(): Promise<boolean> {
    try {
      await navigator.clipboard.readText();
      return true;
    } catch {
      return false;
    }
  }

  // 获取上次读取的文本
  getLastText(): string {
    return this.lastText;
  }

  // 清空记录
  clear(): void {
    this.lastText = '';
    this.lastReadTime = 0;
  }
}

// 单例模式
let clipboardManager: ClipboardManager | null = null;

export const getClipboardManager = (): ClipboardManager => {
  if (!clipboardManager) {
    clipboardManager = new ClipboardManager();
  }
  return clipboardManager;
};

export default ClipboardManager;
