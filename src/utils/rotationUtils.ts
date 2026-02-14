// 旋转工具 - 支持竖排文字
import type { CharacterItem } from './ocrEngine';

export type RotationAngle = 0 | 90 | 180 | 270;

export interface RotatedImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

// 旋转图片
export function rotateImage(
  imageSource: HTMLImageElement,
  angle: RotationAngle
): RotatedImage {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const isVertical = angle === 90 || angle === 270;
  
  // 设置画布尺寸
  canvas.width = isVertical ? imageSource.height : imageSource.width;
  canvas.height = isVertical ? imageSource.width : imageSource.height;

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 保存状态
  ctx.save();

  // 移动画布中心
  ctx.translate(canvas.width / 2, canvas.height / 2);
  
  // 旋转
  ctx.rotate((angle * Math.PI) / 180);

  // 绘制图片（居中）
  ctx.drawImage(
    imageSource,
    -imageSource.width / 2,
    -imageSource.height / 2
  );

  // 恢复状态
  ctx.restore();

  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
  };
}

// 旋转字符坐标
export function rotateCharacter(
  char: CharacterItem,
  angle: RotationAngle,
  imageWidth: number,
  imageHeight: number
): CharacterItem {
  const { x, y, width, height } = char.bbox;
  let newX = x;
  let newY = y;
  let newWidth = width;
  let newHeight = height;

  switch (angle) {
    case 90:
      // 顺时针90度: x' = y, y' = width - x - width
      newX = y;
      newY = imageWidth - x - width;
      newWidth = height;
      newHeight = width;
      break;
    case 180:
      // 180度: x' = width - x - width, y' = height - y - height
      newX = imageWidth - x - width;
      newY = imageHeight - y - height;
      break;
    case 270:
      // 顺时针270度: x' = height - y - height, y' = x
      newX = imageHeight - y - height;
      newY = x;
      newWidth = height;
      newHeight = width;
      break;
    default:
      // 0度，不旋转
      break;
  }

  return {
    ...char,
    bbox: {
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    },
  };
}

// 批量旋转字符
export function rotateCharacters(
  characters: CharacterItem[],
  angle: RotationAngle,
  imageWidth: number,
  imageHeight: number
): CharacterItem[] {
  return characters.map((char) => rotateCharacter(char, angle, imageWidth, imageHeight));
}

// 获取旋转后的图片尺寸
export function getRotatedSize(
  width: number,
  height: number,
  angle: RotationAngle
): { width: number; height: number } {
  const isVertical = angle === 90 || angle === 270;
  return {
    width: isVertical ? height : width,
    height: isVertical ? width : height,
  };
}

// 检测文字方向（简单启发式）
export function detectTextDirection(
  characters: CharacterItem[]
): 'horizontal' | 'vertical' | 'unknown' {
  if (characters.length < 2) return 'unknown';

  // 计算相邻字符的x和y变化
  let xChanges = 0;
  let yChanges = 0;

  for (let i = 1; i < characters.length; i++) {
    const prev = characters[i - 1];
    const curr = characters[i];
    
    const xDiff = Math.abs(curr.bbox.x - prev.bbox.x);
    const yDiff = Math.abs(curr.bbox.y - prev.bbox.y);

    if (xDiff > yDiff) {
      xChanges++;
    } else {
      yChanges++;
    }
  }

  // 如果y变化更多，可能是竖排
  if (yChanges > xChanges * 1.5) {
    return 'vertical';
  }
  
  // 如果x变化更多，可能是横排
  if (xChanges > yChanges * 1.5) {
    return 'horizontal';
  }

  return 'unknown';
}

// 获取旋转建议
export function getRotationSuggestion(
  characters: CharacterItem[]
): { angle: RotationAngle; reason: string } | null {
  const direction = detectTextDirection(characters);

  if (direction === 'vertical') {
    return {
      angle: 90,
      reason: '检测到竖排文字，建议旋转90°',
    };
  }

  return null;
}
