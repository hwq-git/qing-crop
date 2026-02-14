// 增强版OCR引擎 - 集成字符分割和机器学习算法
import type { CharacterItem } from './ocrEngine';
import { CharSegmentation } from './charSegmentation';
import { KMeans, KNN, DecisionTree, FeatureExtractor } from './mlAlgorithms';
import { getOCREngine } from './ocrEngine';

export interface EnhancedOCRResult extends CharacterItem {
  segmentationScore: number;
  mlConfidence: number;
  clusterId?: number;
}

export interface OCROptions {
  useSegmentation: boolean;
  useKMeans: boolean;
  useKNN: boolean;
  useDecisionTree: boolean;
  kMeansClusters: number;
  knnNeighbors: number;
}

const DEFAULT_OPTIONS: OCROptions = {
  useSegmentation: true,
  useKMeans: true,
  useKNN: true,
  useDecisionTree: true,
  kMeansClusters: 10,
  knnNeighbors: 5,
};

class EnhancedOCREngine {
  private options: OCROptions;
  private kmeans: KMeans;
  private knn: KNN;
  private decisionTree: DecisionTree;
  private trainingData: Array<{ features: number[]; label: string }> = [];

  constructor(options: Partial<OCROptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.kmeans = new KMeans(this.options.kMeansClusters);
    this.knn = new KNN(this.options.knnNeighbors);
    this.decisionTree = new DecisionTree();
  }

  // 设置选项
  setOptions(options: Partial<OCROptions>): void {
    this.options = { ...this.options, ...options };
    this.kmeans = new KMeans(this.options.kMeansClusters);
    this.knn = new KNN(this.options.knnNeighbors);
    void this.decisionTree; // 决策树选项变化时重新初始化
  }

  // 增强版OCR识别
  async recognize(
    imageSource: HTMLImageElement,
    language: string = 'chi_sim+eng'
  ): Promise<EnhancedOCRResult[]> {
    const results: EnhancedOCRResult[] = [];

    // 步骤1: 使用基础OCR引擎识别
    const baseEngine = getOCREngine();
    await baseEngine.initialize(language);
    const baseResults = await baseEngine.autoRecognize(imageSource);

    // 步骤2: 字符分割优化
    if (this.options.useSegmentation) {
      const segmentedChars = await this.performSegmentation(imageSource, baseResults);
      results.push(...segmentedChars);
    } else {
      results.push(...baseResults.map(r => ({
        ...r,
        segmentationScore: 0.5,
        mlConfidence: r.confidence / 100,
      })));
    }

    // 步骤3: 特征提取和机器学习优化
    if (results.length > 0) {
      await this.applyMachineLearning(results, imageSource);
    }

    // 步骤4: 后处理优化
    this.postProcess(results);

    return results;
  }

  // 字符分割优化
  private async performSegmentation(
    imageSource: HTMLImageElement,
    baseResults: CharacterItem[]
  ): Promise<EnhancedOCRResult[]> {
    const results: EnhancedOCRResult[] = [];

    // 创建完整图像的canvas
    const canvas = document.createElement('canvas');
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return results;

    ctx.drawImage(imageSource, 0, 0);
    // fullImageData 可用于后续的全局分析
    void ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 对每个基础结果进行局部分割优化
    for (const baseResult of baseResults) {
      // 提取局部区域
      const localCanvas = document.createElement('canvas');
      const localWidth = Math.ceil(baseResult.bbox.width);
      const localHeight = Math.ceil(baseResult.bbox.height);
      localCanvas.width = localWidth;
      localCanvas.height = localHeight;
      const localCtx = localCanvas.getContext('2d');
      
      if (localCtx) {
        localCtx.drawImage(
          imageSource,
          baseResult.bbox.x,
          baseResult.bbox.y,
          baseResult.bbox.width,
          baseResult.bbox.height,
          0,
          0,
          localWidth,
          localHeight
        );

        const localImageData = localCtx.getImageData(0, 0, localWidth, localHeight);

        // 使用Otsu自适应二值化
        const binaryData = CharSegmentation.otsuBinarize(localImageData);

        // 连通区域分析
        const segments = CharSegmentation.connectedComponentAnalysis(binaryData);

        if (segments.length > 1) {
          // 如果分割出多个区域，选择最大的或合并
          const bestSegment = segments.reduce((best, current) => {
            const bestArea = best.width * best.height;
            const currentArea = current.width * current.height;
            return currentArea > bestArea ? current : best;
          });

          // 计算分割质量分数
          const segmentationScore = this.calculateSegmentationScore(bestSegment, segments);

          results.push({
            ...baseResult,
            bbox: {
              x: baseResult.bbox.x + bestSegment.x,
              y: baseResult.bbox.y + bestSegment.y,
              width: bestSegment.width,
              height: bestSegment.height,
            },
            segmentationScore,
            mlConfidence: baseResult.confidence / 100,
          });
        } else if (segments.length === 1) {
          results.push({
            ...baseResult,
            segmentationScore: 0.8,
            mlConfidence: baseResult.confidence / 100,
          });
        } else {
          // 分割失败，使用原始结果
          results.push({
            ...baseResult,
            segmentationScore: 0.5,
            mlConfidence: baseResult.confidence / 100,
          });
        }
      }
    }

    return results;
  }

  // 计算分割质量分数
  private calculateSegmentationScore(
    segment: { width: number; height: number; imageData: ImageData },
    allSegments: Array<{ width: number; height: number; imageData: ImageData }>
  ): number {
    // 可用于计算相对大小
    void segment.width;
    void segment.height;
    void allSegments;
    
    // 基于黑色像素比例
    let blackPixels = 0;
    const data = segment.imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 128) blackPixels++;
    }
    const blackRatio = blackPixels / (data.length / 4);
    
    // 理想的黑色像素比例在 0.1-0.4 之间
    const ratioScore = blackRatio >= 0.1 && blackRatio <= 0.4 ? 1 : 0.5;
    
    // 宽高比合理性
    const aspectRatio = segment.width / segment.height;
    const aspectScore = aspectRatio >= 0.3 && aspectRatio <= 3 ? 1 : 0.5;
    
    return (ratioScore + aspectScore) / 2;
  }

  // 应用机器学习优化
  private async applyMachineLearning(
    results: EnhancedOCRResult[],
    imageSource: HTMLImageElement
  ): Promise<void> {
    // 提取所有字符的特征
    const features: number[][] = [];
    
    for (const result of results) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(result.bbox.width);
      canvas.height = Math.ceil(result.bbox.height);
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(
          imageSource,
          result.bbox.x,
          result.bbox.y,
          result.bbox.width,
          result.bbox.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const featureVector = FeatureExtractor.extractAllFeatures(imageData);
        features.push(featureVector);
      }
    }

    // K-means聚类
    if (this.options.useKMeans && features.length > 0) {
      const k = Math.min(this.options.kMeansClusters, features.length);
      this.kmeans = new KMeans(k);
      this.kmeans.fit(features);
      
      const clusters = this.kmeans.predictBatch(features);
      results.forEach((result, i) => {
        result.clusterId = clusters[i];
      });
    }

    // KNN分类器（如果有训练数据）
    if (this.options.useKNN && this.trainingData.length > 0) {
      this.knn.fit(this.trainingData);
      
      for (let i = 0; i < results.length; i++) {
        const { label, confidence } = this.knn.predictWithConfidence(features[i]);
        if (label && confidence > 0.6) {
          // 如果KNN置信度高，可以考虑修正识别结果
          results[i].mlConfidence = Math.max(results[i].mlConfidence, confidence);
        }
      }
    }

    // 决策树后处理
    if (this.options.useDecisionTree && this.trainingData.length > 0) {
      this.decisionTree.fit(this.trainingData);
      
      for (let i = 0; i < results.length; i++) {
        const predictedLabel = this.decisionTree.predict(features[i]);
        if (predictedLabel) {
          // 决策树结果作为参考
          results[i].mlConfidence = Math.max(results[i].mlConfidence, 0.7);
        }
      }
    }
  }

  // 后处理优化
  private postProcess(results: EnhancedOCRResult[]): void {
    // 1. 基于聚类结果进行一致性检查
    if (this.options.useKMeans) {
      this.clusterBasedCorrection(results);
    }

    // 2. 基于位置关系进行上下文校正
    this.contextBasedCorrection(results);

    // 3. 综合置信度计算
    for (const result of results) {
      // 综合分数 = OCR置信度 * 0.4 + 分割质量 * 0.3 + ML置信度 * 0.3
      result.confidence = Math.round(
        (result.confidence * 0.4 +
         result.segmentationScore * 100 * 0.3 +
         result.mlConfidence * 100 * 0.3)
      );
    }

    // 4. 过滤低质量结果
    // results = results.filter(r => r.confidence > 30);
  }

  // 基于聚类的校正
  private clusterBasedCorrection(results: EnhancedOCRResult[]): void {
    // 按聚类ID分组
    const clusters = new Map<number, EnhancedOCRResult[]>();
    
    for (const result of results) {
      if (result.clusterId !== undefined) {
        const cluster = clusters.get(result.clusterId) || [];
        cluster.push(result);
        clusters.set(result.clusterId, cluster);
      }
    }

    // 对每个聚类进行一致性检查
    for (const [_, cluster] of clusters) {
      if (cluster.length < 2) continue;

      // 统计每个字符的出现次数
      const charCounts = new Map<string, number>();
      for (const item of cluster) {
        const count = charCounts.get(item.char) || 0;
        charCounts.set(item.char, count + 1);
      }

      // 找出最常见的字符
      let maxCount = 0;
      let mostCommonChar = '';
      for (const [char, count] of charCounts) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonChar = char;
        }
      }

      // 如果某个字符占多数，校正其他字符
      if (maxCount > cluster.length / 2) {
        for (const item of cluster) {
          if (item.char !== mostCommonChar && item.confidence < 50) {
            // 只校正低置信度的
            item.char = mostCommonChar;
            item.mlConfidence = Math.max(item.mlConfidence, 0.6);
          }
        }
      }
    }
  }

  // 基于上下文的校正
  private contextBasedCorrection(results: EnhancedOCRResult[]): void {
    // 按阅读顺序排序
    const sorted = [...results].sort((a, b) => {
      if (Math.abs(a.bbox.y - b.bbox.y) > 20) {
        return a.bbox.y - b.bbox.y;
      }
      return a.bbox.x - b.bbox.x;
    });

    // 检查相邻字符的合理性
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // 如果两个相同字符相邻且都很小，可能是噪声
      if (prev.char === curr.char && prev.confidence < 40 && curr.confidence < 40) {
        // 降低置信度
        curr.confidence = Math.max(0, curr.confidence - 20);
      }
    }
  }

  // 添加训练样本
  addTrainingSample(imageData: ImageData, label: string): void {
    const features = FeatureExtractor.extractAllFeatures(imageData);
    this.trainingData.push({ features, label });
  }

  // 批量添加训练样本
  addTrainingSamples(samples: Array<{ imageData: ImageData; label: string }>): void {
    for (const sample of samples) {
      this.addTrainingSample(sample.imageData, sample.label);
    }
  }

  // 清空训练数据
  clearTrainingData(): void {
    this.trainingData = [];
  }

  // 获取训练数据数量
  getTrainingDataCount(): number {
    return this.trainingData.length;
  }

  // 导出训练数据
  exportTrainingData(): string {
    return JSON.stringify(this.trainingData);
  }

  // 导入训练数据
  importTrainingData(data: string): void {
    try {
      this.trainingData = JSON.parse(data);
    } catch (e) {
      console.error('Failed to import training data:', e);
    }
  }
}

// 单例模式
let enhancedOcrEngine: EnhancedOCREngine | null = null;

export const getEnhancedOCREngine = (options?: Partial<OCROptions>): EnhancedOCREngine => {
  if (!enhancedOcrEngine) {
    enhancedOcrEngine = new EnhancedOCREngine(options);
  }
  return enhancedOcrEngine;
};

export default EnhancedOCREngine;
