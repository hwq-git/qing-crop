// OCR 引擎 - 使用 Tesseract.js 进行字符识别

export interface CharacterItem {
  id: string;
  char: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  imageData: string;
  source: 'ocr' | 'manual';
  category?: string;
}

// Tesseract.js CDN 加载 - 使用 v5 版本
const loadTesseract = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).Tesseract) {
      resolve((window as any).Tesseract);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => {
      console.log('Tesseract.js loaded from CDN');
      resolve((window as any).Tesseract);
    };
    script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
    document.head.appendChild(script);
  });
};

class OCREngine {
  private worker: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private Tesseract: any = null;
  private currentLanguage = 'chi_sim+eng';

  getInitialized(): boolean {
    return this.isInitialized;
  }

  getLanguage(): string {
    return this.currentLanguage;
  }

  async initialize(language: string = 'chi_sim+eng'): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.isInitialized;
    }

    this.isInitializing = true;
    this.currentLanguage = language;

    try {
      console.log('Loading Tesseract.js...');
      this.Tesseract = await loadTesseract();
      console.log('Tesseract loaded, creating worker...');

      this.worker = await this.Tesseract.createWorker(language, 1, {
        logger: (m: any) => {
          console.log('Tesseract:', m);
        },
        errorHandler: (e: any) => {
          console.error('Tesseract error:', e);
        }
      });

      console.log('Worker created successfully');
      this.isInitialized = true;
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.error('OCR 初始化失败:', error);
      this.isInitializing = false;
      this.isInitialized = false;
      throw error;
    }
  }

  // 识别图片 - 按单个字符返回
  async recognize(imageSource: HTMLCanvasElement | HTMLImageElement | string): Promise<CharacterItem[]> {
    if (!this.isInitialized || !this.worker) {
      throw new Error('OCR 未初始化，请先调用 initialize()');
    }

    try {
      console.log('Starting recognition...');
      const result = await this.worker.recognize(imageSource);
      console.log('Recognition result:', result);

      const characters: CharacterItem[] = [];

      // 使用 symbols 获取单个字符级别的识别结果
      if (result.data && result.data.symbols) {
        result.data.symbols.forEach((symbol: any, index: number) => {
          const text = symbol.text ? symbol.text.trim() : '';
          
          if (text && text.length === 1) {
            const bbox = symbol.bbox;
            characters.push({
              id: `ocr_${Date.now()}_${index}`,
              char: text,
              bbox: {
                x: bbox.x0,
                y: bbox.y0,
                width: bbox.x1 - bbox.x0,
                height: bbox.y1 - bbox.y0,
              },
              confidence: symbol.confidence || 0,
              imageData: '',
              source: 'ocr',
            });
          }
        });
      }

      // 如果没有 symbols，尝试从 words 拆分
      if (characters.length === 0 && result.data && result.data.words) {
        result.data.words.forEach((word: any, wordIndex: number) => {
          const text = word.text ? word.text.trim() : '';
          const bbox = word.bbox;
          
          if (text) {
            // 将单词拆分为单个字符
            const charWidth = (bbox.x1 - bbox.x0) / text.length;
            
            for (let i = 0; i < text.length; i++) {
              const char = text[i];
              if (char.trim()) {
                characters.push({
                  id: `ocr_${Date.now()}_${wordIndex}_${i}`,
                  char: char,
                  bbox: {
                    x: bbox.x0 + i * charWidth,
                    y: bbox.y0,
                    width: charWidth,
                    height: bbox.y1 - bbox.y0,
                  },
                  confidence: word.confidence || 0,
                  imageData: '',
                  source: 'ocr',
                });
              }
            }
          }
        });
      }

      console.log(`Recognized ${characters.length} characters`);
      return characters;
    } catch (error) {
      console.error('OCR 识别失败:', error);
      throw error;
    }
  }

  // 自动识别整张图片并提取字符图片
  async autoRecognize(imageSource: HTMLImageElement): Promise<CharacterItem[]> {
    const characters = await this.recognize(imageSource);

    // 提取每个字符的图片
    characters.forEach(char => {
      try {
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
          char.imageData = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('Failed to extract image for char:', char.char, e);
      }
    });

    return characters;
  }

  // 从切割区域创建字符项
  createCharacterFromCut(
    imageSource: HTMLImageElement,
    region: { x: number; y: number; width: number; height: number },
    id: string
  ): CharacterItem {
    const canvas = document.createElement('canvas');
    const width = Math.max(1, Math.ceil(region.width));
    const height = Math.max(1, Math.ceil(region.height));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    let imageData = '';
    if (ctx) {
      ctx.drawImage(
        imageSource,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        width,
        height
      );
      imageData = canvas.toDataURL('image/png');
    }

    return {
      id,
      char: '未识别',
      bbox: {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      },
      confidence: 100,
      imageData,
      source: 'manual',
    };
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

// 单例模式
let ocrEngine: OCREngine | null = null;

export const getOCREngine = (): OCREngine => {
  if (!ocrEngine) {
    ocrEngine = new OCREngine();
  }
  return ocrEngine;
};

export default OCREngine;
