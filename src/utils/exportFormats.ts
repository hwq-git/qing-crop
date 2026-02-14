// 训练集导出格式支持
import type { CharacterItem } from './ocrEngine';

export type ExportFormat = 
  | 'json'
  | 'yolo'
  | 'coco'
  | 'txt'
  | 'lmdb'
  | 'icdar';

export interface ExportOption {
  format: ExportFormat;
  name: string;
  description: string;
}

export const EXPORT_OPTIONS: ExportOption[] = [
  { format: 'json', name: 'JSON', description: '人工校对数据' },
  { format: 'yolo', name: 'YOLO', description: '目标检测训练集' },
  { format: 'coco', name: 'COCO', description: '通用检测训练集' },
  { format: 'txt', name: '图片+TXT', description: '简单识别训练集' },
  { format: 'icdar', name: 'ICDAR', description: '端到端训练集' },
];

// YOLO格式导出
export function exportYOLO(
  characters: CharacterItem[],
  imageWidth: number,
  imageHeight: number
): string {
  // YOLO格式: 类别ID 中心X 中心Y 宽度 高度 (均为0-1归一化)
  // 类别: 0=文字
  const lines = characters.map((char) => {
    const centerX = (char.bbox.x + char.bbox.width / 2) / imageWidth;
    const centerY = (char.bbox.y + char.bbox.height / 2) / imageHeight;
    const width = char.bbox.width / imageWidth;
    const height = char.bbox.height / imageHeight;
    return `0 ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
  });
  return lines.join('\n');
}

// COCO格式导出
export function exportCOCO(
  characters: CharacterItem[],
  imageName: string,
  imageWidth: number,
  imageHeight: number
): object {
  const annotations = characters.map((char, index) => ({
    id: index + 1,
    image_id: 1,
    category_id: 1,
    bbox: [char.bbox.x, char.bbox.y, char.bbox.width, char.bbox.height],
    area: char.bbox.width * char.bbox.height,
    segmentation: [],
    iscrowd: 0,
  }));

  return {
    images: [
      {
        id: 1,
        file_name: imageName,
        width: imageWidth,
        height: imageHeight,
      },
    ],
    annotations,
    categories: [
      {
        id: 1,
        name: 'text',
        supercategory: 'text',
      },
    ],
  };
}

// ICDAR格式导出 (四点坐标)
export function exportICDAR(characters: CharacterItem[]): string {
  // ICDAR格式: x1,y1,x2,y2,x3,y3,x4,y4,文字内容
  const lines = characters.map((char) => {
    const x1 = char.bbox.x;
    const y1 = char.bbox.y;
    const x2 = char.bbox.x + char.bbox.width;
    const y2 = char.bbox.y;
    const x3 = char.bbox.x + char.bbox.width;
    const y3 = char.bbox.y + char.bbox.height;
    const x4 = char.bbox.x;
    const y4 = char.bbox.y + char.bbox.height;
    return `${x1},${y1},${x2},${y2},${x3},${y3},${x4},${y4},${char.char}`;
  });
  return lines.join('\n');
}

// 简单TXT格式导出
export function exportTXT(characters: CharacterItem[]): { name: string; content: string }[] {
  return characters.map((char, index) => ({
    name: `crop_${String(index + 1).padStart(3, '0')}.txt`,
    content: char.char,
  }));
}

// JSON格式导出 (人工校对)
export function exportJSON(
  characters: CharacterItem[],
  imageName: string,
  imageWidth: number,
  imageHeight: number,
  rotation: number = 0
): object {
  return {
    version: '1.0',
    exportTime: new Date().toISOString(),
    image: {
      name: imageName,
      width: imageWidth,
      height: imageHeight,
      rotation,
    },
    characters: characters.map((char) => ({
      id: char.id,
      char: char.char,
      bbox: char.bbox,
      confidence: char.confidence,
      source: char.source,
    })),
    stats: {
      total: characters.length,
      unique: new Set(characters.map((c) => c.char)).size,
    },
  };
}

// 下载文件
export function downloadFile(content: string | Blob, filename: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// 批量导出图片
export function downloadImages(characters: CharacterItem[], prefix: string = 'crop'): void {
  characters.forEach((char, index) => {
    if (char.imageData) {
      const link = document.createElement('a');
      link.download = `${prefix}_${String(index + 1).padStart(3, '0')}.png`;
      link.href = char.imageData;
      link.click();
    }
  });
}
