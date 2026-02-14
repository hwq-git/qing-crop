// 机器学习算法 - K-means聚类、K-近邻分类器、决策树

export interface FeatureVector {
  features: number[];
  label?: string;
}

// K-means聚类算法
export class KMeans {
  private k: number;
  private centroids: number[][] = [];
  private maxIterations: number = 100;

  constructor(k: number) {
    this.k = k;
  }

  // 训练（聚类）
  fit(data: number[][]): number[][] {
    if (data.length === 0) return [];
    
    // 数据维度
    void data[0].length;
    
    // 随机初始化质心
    this.centroids = this.initializeCentroids(data);
    
    let iterations = 0;
    let converged = false;
    
    while (!converged && iterations < this.maxIterations) {
      // 分配点到最近的质心
      const clusters: number[][][] = Array.from({ length: this.k }, () => []);
      
      for (const point of data) {
        const clusterIndex = this.findNearestCentroid(point);
        clusters[clusterIndex].push(point);
      }
      
      // 更新质心
      const newCentroids: number[][] = [];
      for (let i = 0; i < this.k; i++) {
        if (clusters[i].length > 0) {
          newCentroids.push(this.calculateCentroid(clusters[i]));
        } else {
          // 空簇，重新随机初始化
          newCentroids.push(this.centroids[i]);
        }
      }
      
      // 检查收敛
      converged = this.checkConvergence(this.centroids, newCentroids);
      this.centroids = newCentroids;
      iterations++;
    }
    
    return this.centroids;
  }

  // 预测（分配点到最近的簇）
  predict(point: number[]): number {
    return this.findNearestCentroid(point);
  }

  // 批量预测
  predictBatch(data: number[][]): number[] {
    return data.map(point => this.predict(point));
  }

  // 初始化质心（K-means++改进）
  private initializeCentroids(data: number[][]): number[][] {
    const centroids: number[][] = [];
    const n = data.length;
    
    // 随机选择第一个质心
    centroids.push(data[Math.floor(Math.random() * n)]);
    
    // 选择剩余的质心
    while (centroids.length < this.k) {
      const distances: number[] = [];
      
      for (const point of data) {
        let minDist = Infinity;
        for (const centroid of centroids) {
          const dist = this.euclideanDistance(point, centroid);
          minDist = Math.min(minDist, dist);
        }
        distances.push(minDist * minDist); // 平方距离
      }
      
      // 按概率选择下一个质心
      const sumDistances = distances.reduce((a, b) => a + b, 0);
      let random = Math.random() * sumDistances;
      
      for (let i = 0; i < distances.length; i++) {
        random -= distances[i];
        if (random <= 0) {
          centroids.push(data[i]);
          break;
        }
      }
    }
    
    return centroids;
  }

  // 找到最近的质心
  private findNearestCentroid(point: number[]): number {
    let minDist = Infinity;
    let nearestIndex = 0;
    
    for (let i = 0; i < this.centroids.length; i++) {
      const dist = this.euclideanDistance(point, this.centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }
    
    return nearestIndex;
  }

  // 计算质心
  private calculateCentroid(points: number[][]): number[] {
    const dimensions = points[0].length;
    const centroid: number[] = new Array(dimensions).fill(0);
    
    for (const point of points) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += point[i];
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= points.length;
    }
    
    return centroid;
  }

  // 检查收敛
  private checkConvergence(oldCentroids: number[][], newCentroids: number[][]): boolean {
    const threshold = 0.001;
    
    for (let i = 0; i < oldCentroids.length; i++) {
      const dist = this.euclideanDistance(oldCentroids[i], newCentroids[i]);
      if (dist > threshold) return false;
    }
    
    return true;
  }

  // 欧氏距离
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  // 获取质心
  getCentroids(): number[][] {
    return this.centroids;
  }
}

// K-近邻分类器
export class KNN {
  private k: number;
  private trainingData: FeatureVector[] = [];

  constructor(k: number = 5) {
    this.k = k;
  }

  // 训练（存储训练数据）
  fit(data: FeatureVector[]): void {
    this.trainingData = data;
  }

  // 预测单个样本
  predict(features: number[]): string | null {
    if (this.trainingData.length === 0) return null;

    // 计算与所有训练样本的距离
    const distances: Array<{ label: string; distance: number }> = [];
    
    for (const sample of this.trainingData) {
      const dist = this.euclideanDistance(features, sample.features);
      if (sample.label) {
        distances.push({ label: sample.label, distance: dist });
      }
    }
    
    // 按距离排序
    distances.sort((a, b) => a.distance - b.distance);
    
    // 取前k个最近邻
    const kNearest = distances.slice(0, Math.min(this.k, distances.length));
    
    // 投票
    const votes = new Map<string, number>();
    for (const neighbor of kNearest) {
      const count = votes.get(neighbor.label) || 0;
      votes.set(neighbor.label, count + 1);
    }
    
    // 返回得票最多的类别
    let maxVotes = 0;
    let predictedLabel: string | null = null;
    
    for (const [label, count] of votes) {
      if (count > maxVotes) {
        maxVotes = count;
        predictedLabel = label;
      }
    }
    
    return predictedLabel;
  }

  // 批量预测
  predictBatch(features: number[][]): (string | null)[] {
    return features.map(f => this.predict(f));
  }

  // 预测并返回置信度
  predictWithConfidence(features: number[]): { label: string | null; confidence: number } {
    if (this.trainingData.length === 0) {
      return { label: null, confidence: 0 };
    }

    const distances: Array<{ label: string; distance: number }> = [];
    
    for (const sample of this.trainingData) {
      const dist = this.euclideanDistance(features, sample.features);
      if (sample.label) {
        distances.push({ label: sample.label, distance: dist });
      }
    }
    
    distances.sort((a, b) => a.distance - b.distance);
    const kNearest = distances.slice(0, Math.min(this.k, distances.length));
    
    // 计算置信度（基于距离加权）
    const votes = new Map<string, number>();
    let totalWeight = 0;
    
    for (const neighbor of kNearest) {
      // 距离越近权重越大
      const weight = 1 / (neighbor.distance + 0.001);
      const current = votes.get(neighbor.label) || 0;
      votes.set(neighbor.label, current + weight);
      totalWeight += weight;
    }
    
    let maxWeight = 0;
    let predictedLabel: string | null = null;
    
    for (const [label, weight] of votes) {
      if (weight > maxWeight) {
        maxWeight = weight;
        predictedLabel = label;
      }
    }
    
    const confidence = totalWeight > 0 ? maxWeight / totalWeight : 0;
    
    return { label: predictedLabel, confidence };
  }

  // 欧氏距离
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  // 添加训练样本
  addSample(sample: FeatureVector): void {
    this.trainingData.push(sample);
  }

  // 清空训练数据
  clear(): void {
    this.trainingData = [];
  }
}

// 简单决策树（用于OCR后处理）
export class DecisionTree {
  private tree: TreeNode | null = null;

  // 训练决策树
  fit(data: FeatureVector[]): void {
    if (data.length === 0) return;
    this.tree = this.buildTree(data, 0);
  }

  // 预测
  predict(features: number[]): string | null {
    if (!this.tree) return null;
    return this.traverseTree(features, this.tree);
  }

  // 构建决策树
  private buildTree(data: FeatureVector[], depth: number): TreeNode {
    // 获取所有标签
    const labels = new Set(data.map(d => d.label).filter(Boolean) as string[]);
    
    // 如果所有样本属于同一类别，返回叶节点
    if (labels.size === 1) {
      return {
        type: 'leaf',
        label: Array.from(labels)[0],
      };
    }
    
    // 如果达到最大深度或样本太少，返回多数类
    if (depth >= 5 || data.length < 5) {
      const majorityLabel = this.getMajorityLabel(data);
      return {
        type: 'leaf',
        label: majorityLabel,
      };
    }
    
    // 找到最佳分裂特征
    const { featureIndex, threshold } = this.findBestSplit(data);
    
    // 分裂数据
    const leftData: FeatureVector[] = [];
    const rightData: FeatureVector[] = [];
    
    for (const sample of data) {
      if (sample.features[featureIndex] <= threshold) {
        leftData.push(sample);
      } else {
        rightData.push(sample);
      }
    }
    
    // 如果分裂没有改善，返回叶节点
    if (leftData.length === 0 || rightData.length === 0) {
      return {
        type: 'leaf',
        label: this.getMajorityLabel(data),
      };
    }
    
    return {
      type: 'internal',
      featureIndex,
      threshold,
      left: this.buildTree(leftData, depth + 1),
      right: this.buildTree(rightData, depth + 1),
    };
  }

  // 遍历决策树
  private traverseTree(features: number[], node: TreeNode): string | null {
    if (node.type === 'leaf') {
      return node.label || null;
    }
    
    if (features[node.featureIndex!] <= node.threshold!) {
      return this.traverseTree(features, node.left!);
    } else {
      return this.traverseTree(features, node.right!);
    }
  }

  // 找到最佳分裂点
  private findBestSplit(data: FeatureVector[]): { featureIndex: number; threshold: number } {
    const numFeatures = data[0].features.length;
    let bestGain = -Infinity;
    let bestFeature = 0;
    let bestThreshold = 0;
    
    const parentEntropy = this.calculateEntropy(data);
    
    for (let featureIndex = 0; featureIndex < numFeatures; featureIndex++) {
      // 获取该特征的所有值
      const values = data.map(d => d.features[featureIndex]).sort((a, b) => a - b);
      
      // 尝试每个可能的分裂点
      for (let i = 0; i < values.length - 1; i++) {
        const threshold = (values[i] + values[i + 1]) / 2;
        
        const leftData = data.filter(d => d.features[featureIndex] <= threshold);
        const rightData = data.filter(d => d.features[featureIndex] > threshold);
        
        if (leftData.length === 0 || rightData.length === 0) continue;
        
        // 计算信息增益
        const leftEntropy = this.calculateEntropy(leftData);
        const rightEntropy = this.calculateEntropy(rightData);
        
        const leftWeight = leftData.length / data.length;
        const rightWeight = rightData.length / data.length;
        
        const gain = parentEntropy - (leftWeight * leftEntropy + rightWeight * rightEntropy);
        
        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = featureIndex;
          bestThreshold = threshold;
        }
      }
    }
    
    return { featureIndex: bestFeature, threshold: bestThreshold };
  }

  // 计算熵
  private calculateEntropy(data: FeatureVector[]): number {
    const labelCounts = new Map<string, number>();
    
    for (const sample of data) {
      if (sample.label) {
        const count = labelCounts.get(sample.label) || 0;
        labelCounts.set(sample.label, count + 1);
      }
    }
    
    let entropy = 0;
    const total = data.length;
    
    for (const count of labelCounts.values()) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  // 获取多数类
  private getMajorityLabel(data: FeatureVector[]): string {
    const labelCounts = new Map<string, number>();
    
    for (const sample of data) {
      if (sample.label) {
        const count = labelCounts.get(sample.label) || 0;
        labelCounts.set(sample.label, count + 1);
      }
    }
    
    let maxCount = 0;
    let majorityLabel = '';
    
    for (const [label, count] of labelCounts) {
      if (count > maxCount) {
        maxCount = count;
        majorityLabel = label;
      }
    }
    
    return majorityLabel;
  }
}

// 决策树节点接口
interface TreeNode {
  type: 'leaf' | 'internal';
  label?: string;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

// 特征提取器 - 提取字符图像的特征向量
export class FeatureExtractor {
  // 提取HOG-like特征（简化版）
  static extractHOGFeatures(imageData: ImageData, cellSize: number = 8): number[] {
    const { data, width, height } = imageData;
    const features: number[] = [];
    
    // 将图像分成cell
    const numCellsX = Math.ceil(width / cellSize);
    const numCellsY = Math.ceil(height / cellSize);
    
    for (let cy = 0; cy < numCellsY; cy++) {
      for (let cx = 0; cx < numCellsX; cx++) {
        const cellX = cx * cellSize;
        const cellY = cy * cellSize;
        
        // 计算cell内的梯度直方图
        const histogram = new Array(9).fill(0);
        
        for (let y = cellY; y < Math.min(cellY + cellSize, height - 1); y++) {
          for (let x = cellX; x < Math.min(cellX + cellSize, width - 1); x++) {
            const idx = (y * width + x) * 4;
            const rightIdx = (y * width + x + 1) * 4;
            const downIdx = ((y + 1) * width + x) * 4;
            
            // 计算梯度
            const gx = data[rightIdx] - data[idx];
            const gy = data[downIdx] - data[idx];
            
            // 计算梯度方向和大小
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            const orientation = Math.atan2(gy, gx) * (180 / Math.PI);
            
            // 量化到9个bin
            const bin = Math.floor((orientation + 180) / 40) % 9;
            histogram[bin] += magnitude;
          }
        }
        
        // 归一化
        const sum = histogram.reduce((a, b) => a + b, 0);
        if (sum > 0) {
          for (let i = 0; i < 9; i++) {
            histogram[i] /= sum;
          }
        }
        
        features.push(...histogram);
      }
    }
    
    return features;
  }

  // 提取投影特征
  static extractProjectionFeatures(imageData: ImageData): number[] {
    const { data, width, height } = imageData;
    const features: number[] = [];
    
    // 水平投影
    const horizontal: number[] = new Array(height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) {
          horizontal[y]++;
        }
      }
    }
    
    // 垂直投影
    const vertical: number[] = new Array(width).fill(0);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) {
          vertical[x]++;
        }
      }
    }
    
    // 归一化
    const hMax = Math.max(...horizontal);
    const vMax = Math.max(...vertical);
    
    if (hMax > 0) {
      features.push(...horizontal.map(v => v / hMax));
    }
    if (vMax > 0) {
      features.push(...vertical.map(v => v / vMax));
    }
    
    return features;
  }

  // 提取轮廓特征
  static extractContourFeatures(imageData: ImageData): number[] {
    const { data, width, height } = imageData;
    const features: number[] = [];
    
    // 计算轮廓点数
    let contourPoints = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) {
          // 检查是否是边界点
          const neighbors = [
            ((y - 1) * width + x) * 4,
            ((y + 1) * width + x) * 4,
            (y * width + x - 1) * 4,
            (y * width + x + 1) * 4,
          ];
          
          let isBoundary = false;
          for (const nIdx of neighbors) {
            if (data[nIdx] >= 128) {
              isBoundary = true;
              break;
            }
          }
          
          if (isBoundary) {
            contourPoints++;
          }
        }
      }
    }
    
    // 计算宽高比
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    const charWidth = maxX - minX + 1;
    const charHeight = maxY - minY + 1;
    const aspectRatio = charHeight > 0 ? charWidth / charHeight : 1;
    const blackPixels = data.filter((v, i) => i % 4 === 0 && v < 128).length;
    const totalPixels = (width * height);
    
    features.push(
      contourPoints / (width * height),  // 轮廓密度
      aspectRatio,                        // 宽高比
      blackPixels / totalPixels,         // 黑色像素比例
      charWidth / width,                 // 相对宽度
      charHeight / height,               // 相对高度
    );
    
    return features;
  }

  // 综合特征提取
  static extractAllFeatures(imageData: ImageData): number[] {
    const hogFeatures = this.extractHOGFeatures(imageData);
    const projectionFeatures = this.extractProjectionFeatures(imageData);
    const contourFeatures = this.extractContourFeatures(imageData);
    
    return [...hogFeatures, ...projectionFeatures, ...contourFeatures];
  }
}

export default { KMeans, KNN, DecisionTree, FeatureExtractor };
