// 自动保存管理器
import type { CharacterItem } from './ocrEngine';

export interface ProjectData {
  version: string;
  timestamp: number;
  imageData: string | null;
  imageName: string;
  characters: CharacterItem[];
  rotation: number;
}

const STORAGE_KEY = 'qingcrop_autosave';
const AUTOSAVE_INTERVAL = 30000; // 30秒

class AutoSaveManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isEnabled = true;

  // 启用自动保存
  enable(): void {
    this.isEnabled = true;
  }

  // 禁用自动保存
  disable(): void {
    this.isEnabled = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 开始自动保存
  startAutoSave(
    getData: () => { imageData: string | null; imageName: string; characters: CharacterItem[]; rotation: number }
  ): void {
    if (!this.isEnabled) return;

    this.stopAutoSave();
    
    this.intervalId = setInterval(() => {
      const data = getData();
      this.save(data);
    }, AUTOSAVE_INTERVAL);
  }

  // 停止自动保存
  stopAutoSave(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 保存数据
  save(data: {
    imageData: string | null;
    imageName: string;
    characters: CharacterItem[];
    rotation: number;
  }): void {
    try {
      const projectData: ProjectData = {
        version: '1.0',
        timestamp: Date.now(),
        ...data,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
      console.log('Auto saved at', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Auto save failed:', error);
    }
  }

  // 加载数据
  load(): ProjectData | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data) as ProjectData;
      }
    } catch (error) {
      console.error('Load auto save failed:', error);
    }
    return null;
  }

  // 检查是否有自动保存的数据
  hasSavedData(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  // 清除自动保存
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // 导出项目文件
  exportProject(data: ProjectData): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qingcrop_project_${Date.now()}.qingcrop`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // 导入项目文件
  async importProject(file: File): Promise<ProjectData | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as ProjectData;
          resolve(data);
        } catch (error) {
          console.error('Import project failed:', error);
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
  }

  // 获取自动保存状态
  getStatus(): { enabled: boolean; hasData: boolean } {
    return {
      enabled: this.isEnabled,
      hasData: this.hasSavedData(),
    };
  }
}

// 单例模式
let autoSaveManager: AutoSaveManager | null = null;

export const getAutoSaveManager = (): AutoSaveManager => {
  if (!autoSaveManager) {
    autoSaveManager = new AutoSaveManager();
  }
  return autoSaveManager;
};

export default AutoSaveManager;
