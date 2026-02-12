// 字符归类工具
import type { CharacterItem } from './ocrEngine';

export interface CharacterGroup {
  char: string;
  items: CharacterItem[];
  count: number;
}

export class CharacterClassifier {
  // 自动归类相同字符 - 每组只包含完全相同的单个字符
  static classify(characters: CharacterItem[]): CharacterGroup[] {
    const groups: Map<string, CharacterItem[]> = new Map();

    characters.forEach(char => {
      // 只取第一个字符作为归类键（确保每组一个字符）
      const key = char.char.charAt(0);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(char);
    });

    return Array.from(groups.entries())
      .map(([char, items]) => ({
        char,
        items,
        count: items.length,
      }))
      .sort((a, b) => b.count - a.count); // 按数量降序排列
  }

  // 按位置排序字符（从左到右，从上到下）
  static sortByPosition(characters: CharacterItem[]): CharacterItem[] {
    return [...characters].sort((a, b) => {
      // 先按 y 坐标排序（行优先）
      const yDiff = a.bbox.y - b.bbox.y;
      if (Math.abs(yDiff) > 20) { // 20px 容差
        return yDiff;
      }
      // 同行按 x 坐标排序
      return a.bbox.x - b.bbox.x;
    });
  }

  // 获取字符统计信息
  static getStats(characters: CharacterItem[]) {
    const groups = this.classify(characters);
    return {
      total: characters.length,
      unique: groups.length,
      groups: groups.map(g => ({
        char: g.char,
        count: g.count,
      })),
    };
  }
}

export default CharacterClassifier;
