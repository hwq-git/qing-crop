// 操作历史管理器 - 支持撤销/重做
import type { CharacterItem } from './ocrEngine';

export type OperationType = 
  | 'add_char'
  | 'delete_char'
  | 'move_char'
  | 'resize_char'
  | 'edit_text'
  | 'rotate_image'
  | 'batch_add'
  | 'clear_all'
  | 'ocr';

export interface HistoryState {
  characters: CharacterItem[];
  rotation: number;
  timestamp: number;
}

export interface HistoryOperation {
  type: OperationType;
  description: string;
  prevState: HistoryState;
  nextState: HistoryState;
  timestamp: number;
}

class HistoryManager {
  private undoStack: HistoryOperation[] = [];
  private redoStack: HistoryOperation[] = [];
  private maxHistorySize = 50;
  private currentState: HistoryState | null = null;

  // 初始化当前状态
  initState(characters: CharacterItem[], rotation: number = 0) {
    this.currentState = {
      characters: JSON.parse(JSON.stringify(characters)),
      rotation,
      timestamp: Date.now(),
    };
  }

  // 获取当前状态
  getCurrentState(): HistoryState | null {
    return this.currentState;
  }

  // 执行操作并记录历史
  execute(
    type: OperationType,
    description: string,
    prevCharacters: CharacterItem[],
    nextCharacters: CharacterItem[],
    rotation: number = 0
  ): void {
    const prevState: HistoryState = {
      characters: JSON.parse(JSON.stringify(prevCharacters)),
      rotation,
      timestamp: Date.now(),
    };

    const nextState: HistoryState = {
      characters: JSON.parse(JSON.stringify(nextCharacters)),
      rotation,
      timestamp: Date.now(),
    };

    const operation: HistoryOperation = {
      type,
      description,
      prevState,
      nextState,
      timestamp: Date.now(),
    };

    this.undoStack.push(operation);
    
    // 限制历史记录数量
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }

    // 清空重做栈
    this.redoStack = [];
    
    // 更新当前状态
    this.currentState = nextState;
  }

  // 撤销
  undo(): HistoryState | null {
    if (this.undoStack.length === 0) return null;

    const operation = this.undoStack.pop()!;
    this.redoStack.push(operation);
    
    this.currentState = operation.prevState;
    return operation.prevState;
  }

  // 重做
  redo(): HistoryState | null {
    if (this.redoStack.length === 0) return null;

    const operation = this.redoStack.pop()!;
    this.undoStack.push(operation);
    
    this.currentState = operation.nextState;
    return operation.nextState;
  }

  // 是否可以撤销
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  // 是否可以重做
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // 获取撤销描述
  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  // 获取重做描述
  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  // 获取历史记录数量
  getHistoryCount(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    };
  }

  // 清空历史
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = null;
  }
}

// 单例模式
let historyManager: HistoryManager | null = null;

export const getHistoryManager = (): HistoryManager => {
  if (!historyManager) {
    historyManager = new HistoryManager();
  }
  return historyManager;
};

export default HistoryManager;
