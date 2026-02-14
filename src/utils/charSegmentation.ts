// 字符分割算法 - 优化OCR识别前的字符分割

export interface SegmentedChar {
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: ImageData;
}

export interface ProjectionProfile {
  horizontal: number[];
  vertical: number[];
}

export class CharSegmentation {
  // 二值化图像
  static binarize(imageData: ImageData, threshold: number = 128): ImageData {
    const { data, width, height } = imageData;
    const binaryData = new Uint8ClampedArray(data.length);
    
    for (let i = 0; i < data.length; i += 4) {
      // 灰度化
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // 二值化
      const value = gray < threshold ? 0 : 255;
      binaryData[i] = value;
      binaryData[i + 1] = value;
      binaryData[i + 2] = value;
      binaryData[i + 3] = 255;
    }
    
    return new ImageData(binaryData, width, height);
  }

  // 计算投影直方图
  static calculateProjection(imageData: ImageData): ProjectionProfile {
    const { data, width, height } = imageData;
    const horizontal: number[] = new Array(height).fill(0);
    const vertical: number[] = new Array(width).fill(0);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // 如果是黑色像素（文字）
        if (data[idx] < 128) {
          horizontal[y]++;
          vertical[x]++;
        }
      }
    }
    
    return { horizontal, vertical };
  }

  // 基于投影的字符分割
  static segmentByProjection(
    imageData: ImageData,
    minCharWidth: number = 10,
    minCharHeight: number = 10
  ): SegmentedChar[] {
    const binary = this.binarize(imageData);
    const { horizontal, vertical } = this.calculateProjection(binary);
    const { width, height } = imageData;
    
    const chars: SegmentedChar[] = [];
    
    // 1. 先按水平投影分割行
    const rowRanges = this.findRanges(horizontal, 1);
    
    for (const row of rowRanges) {
      if (row.end - row.start < minCharHeight) continue;
      
      // 2. 在每一行内按垂直投影分割字符
      const rowVertical = vertical.slice(0); // 复制
      // 只考虑当前行的垂直投影
      for (let x = 0; x < width; x++) {
        // 计算该列在当前行范围内的黑色像素数
        let count = 0;
        for (let y = row.start; y < row.end; y++) {
          const idx = (y * width + x) * 4;
          if (binary.data[idx] < 128) count++;
        }
        rowVertical[x] = count;
      }
      
      const colRanges = this.findRanges(rowVertical, 1);
      
      for (const col of colRanges) {
        if (col.end - col.start < minCharWidth) continue;
        
        // 提取字符区域
        const charWidth = col.end - col.start;
        const charHeight = row.end - row.start;
        const charCanvas = document.createElement('canvas');
        charCanvas.width = charWidth;
        charCanvas.height = charHeight;
        const ctx = charCanvas.getContext('2d');
        
        if (ctx) {
          // 创建临时canvas来提取区域
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.putImageData(binary, 0, 0);
            ctx.drawImage(
              tempCanvas,
              col.start, row.start, charWidth, charHeight,
              0, 0, charWidth, charHeight
            );
          }
          
          const charImageData = ctx.getImageData(0, 0, charWidth, charHeight);
          
          // 过滤掉噪声区域（黑色像素太少）
          const blackPixelRatio = this.calculateBlackPixelRatio(charImageData);
          if (blackPixelRatio > 0.05 && blackPixelRatio < 0.95) {
            chars.push({
              x: col.start,
              y: row.start,
              width: charWidth,
              height: charHeight,
              imageData: charImageData,
            });
          }
        }
      }
    }
    
    return chars;
  }

  // 查找投影中的有效范围
  private static findRanges(projection: number[], minGap: number): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    let inRange = false;
    let start = 0;
    
    for (let i = 0; i < projection.length; i++) {
      if (projection[i] > 0) {
        if (!inRange) {
          start = i;
          inRange = true;
        }
      } else {
        if (inRange) {
          // 检查间隔是否足够大
          let gapSize = 0;
          for (let j = i; j < projection.length && projection[j] === 0; j++) {
            gapSize++;
          }
          
          if (gapSize >= minGap || i === projection.length - 1) {
            ranges.push({ start, end: i });
            inRange = false;
          }
        }
      }
    }
    
    // 处理最后一个范围
    if (inRange) {
      ranges.push({ start, end: projection.length });
    }
    
    return ranges;
  }

  // 计算黑色像素比例
  private static calculateBlackPixelRatio(imageData: ImageData): number {
    const { data } = imageData;
    let blackCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 128) {
        blackCount++;
      }
    }
    
    return blackCount / (data.length / 4);
  }

  // 连通区域分析
  static connectedComponentAnalysis(imageData: ImageData): SegmentedChar[] {
    const binary = this.binarize(imageData);
    const { data, width, height } = binary;
    
    // 标记矩阵
    const labels = new Int32Array(width * height);
    labels.fill(-1);
    
    let currentLabel = 0;
    const labelMap = new Map<number, Set<number>>();
    
    // 第一次遍历：标记连通区域
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pixelIdx = idx * 4;
        
        // 如果是背景，跳过
        if (data[pixelIdx] >= 128) continue;
        
        // 查找邻居标签
        const neighbors: number[] = [];
        
        // 左邻居
        if (x > 0 && labels[idx - 1] !== -1) {
          neighbors.push(labels[idx - 1]);
        }
        // 上邻居
        if (y > 0 && labels[idx - width] !== -1) {
          neighbors.push(labels[idx - width]);
        }
        // 左上邻居
        if (x > 0 && y > 0 && labels[idx - width - 1] !== -1) {
          neighbors.push(labels[idx - width - 1]);
        }
        // 右上邻居
        if (x < width - 1 && y > 0 && labels[idx - width + 1] !== -1) {
          neighbors.push(labels[idx - width + 1]);
        }
        
        if (neighbors.length === 0) {
          // 新连通区域
          labels[idx] = currentLabel;
          labelMap.set(currentLabel, new Set([currentLabel]));
          currentLabel++;
        } else {
          // 使用最小标签
          const minLabel = Math.min(...neighbors);
          labels[idx] = minLabel;
          
          // 合并等价标签
          neighbors.forEach(label => {
            if (label !== minLabel) {
              const set1 = labelMap.get(minLabel)!;
              const set2 = labelMap.get(label)!;
              set2.forEach(l => {
                set1.add(l);
                labelMap.set(l, set1);
              });
            }
          });
        }
      }
    }
    
    // 第二次遍历：统一标签
    const finalLabels = new Int32Array(width * height);
    finalLabels.fill(-1);
    
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== -1) {
        const rootLabel = Math.min(...Array.from(labelMap.get(labels[i])!));
        finalLabels[i] = rootLabel;
      }
    }
    
    // 提取每个连通区域的边界框
    const boundingBoxes = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const label = finalLabels[idx];
        
        if (label !== -1) {
          if (!boundingBoxes.has(label)) {
            boundingBoxes.set(label, { minX: x, minY: y, maxX: x, maxY: y });
          } else {
            const box = boundingBoxes.get(label)!;
            box.minX = Math.min(box.minX, x);
            box.minY = Math.min(box.minY, y);
            box.maxX = Math.max(box.maxX, x);
            box.maxY = Math.max(box.maxY, y);
          }
        }
      }
    }
    
    // 转换为SegmentedChar
    const chars: SegmentedChar[] = [];
    
    boundingBoxes.forEach((box, label) => {
      const charWidth = box.maxX - box.minX + 1;
      const charHeight = box.maxY - box.minY + 1;
      
      // 过滤太小的区域
      if (charWidth < 5 || charHeight < 5) return;
      
      const charCanvas = document.createElement('canvas');
      charCanvas.width = charWidth;
      charCanvas.height = charHeight;
      const ctx = charCanvas.getContext('2d');
      
      if (ctx) {
        // 创建区域图像
        const charData = ctx.createImageData(charWidth, charHeight);
        
        for (let y = box.minY; y <= box.maxY; y++) {
          for (let x = box.minX; x <= box.maxX; x++) {
            const srcIdx = y * width + x;
            const dstIdx = (y - box.minY) * charWidth + (x - box.minX);
            
            if (finalLabels[srcIdx] === label) {
              charData.data[dstIdx * 4] = 0;
              charData.data[dstIdx * 4 + 1] = 0;
              charData.data[dstIdx * 4 + 2] = 0;
              charData.data[dstIdx * 4 + 3] = 255;
            } else {
              charData.data[dstIdx * 4] = 255;
              charData.data[dstIdx * 4 + 1] = 255;
              charData.data[dstIdx * 4 + 2] = 255;
              charData.data[dstIdx * 4 + 3] = 255;
            }
          }
        }
        
        chars.push({
          x: box.minX,
          y: box.minY,
          width: charWidth,
          height: charHeight,
          imageData: charData,
        });
      }
    });
    
    return chars;
  }

  // 自适应阈值二值化（Otsu算法）
  static otsuBinarize(imageData: ImageData): ImageData {
    const { data } = imageData;
    const grayData = new Uint8Array(data.length / 4);
    
    // 转换为灰度
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      grayData[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    // 计算直方图
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < grayData.length; i++) {
      histogram[grayData[i]]++;
    }
    
    // Otsu算法找最优阈值
    let maxVariance = 0;
    let optimalThreshold = 128;
    const total = grayData.length;
    
    for (let t = 0; t < 256; t++) {
      let w0 = 0, w1 = 0;
      let sum0 = 0, sum1 = 0;
      
      for (let i = 0; i <= t; i++) {
        w0 += histogram[i];
        sum0 += i * histogram[i];
      }
      
      for (let i = t + 1; i < 256; i++) {
        w1 += histogram[i];
        sum1 += i * histogram[i];
      }
      
      if (w0 === 0 || w1 === 0) continue;
      
      const mean0 = sum0 / w0;
      const mean1 = sum1 / w1;
      
      const variance = w0 * w1 * (mean0 - mean1) * (mean0 - mean1) / (total * total);
      
      if (variance > maxVariance) {
        maxVariance = variance;
        optimalThreshold = t;
      }
    }
    
    return this.binarize(imageData, optimalThreshold);
  }
}

export default CharSegmentation;
