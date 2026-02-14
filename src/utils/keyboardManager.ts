// 快捷键管理器

export type ShortcutAction = 
  | 'undo'
  | 'redo'
  | 'delete'
  | 'copy'
  | 'paste'
  | 'save'
  | 'select_all'
  | 'add_char'
  | 'rotate'
  | 'ocr'
  | 'export';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: ShortcutAction;
  description: string;
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'z', ctrl: true, action: 'undo', description: '撤销' },
  { key: 'y', ctrl: true, action: 'redo', description: '重做' },
  { key: 'Delete', action: 'delete', description: '删除选中' },
  { key: 'c', ctrl: true, action: 'copy', description: '复制' },
  { key: 'v', ctrl: true, action: 'paste', description: '粘贴' },
  { key: 's', ctrl: true, action: 'save', description: '保存项目' },
  { key: 'a', ctrl: true, action: 'select_all', description: '全选' },
  { key: 'n', ctrl: true, action: 'add_char', description: '添加字符框' },
  { key: 'r', ctrl: true, action: 'rotate', description: '旋转90°' },
  { key: 'o', ctrl: true, action: 'ocr', description: 'OCR识别' },
  { key: 'e', ctrl: true, action: 'export', description: '导出' },
];

// 方向键微调
export const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

type ShortcutHandler = (action: ShortcutAction, event: KeyboardEvent) => void;

class KeyboardManager {
  private handlers: ShortcutHandler[] = [];
  private isEnabled = true;
  private pressedKeys = new Set<string>();

  // 启用快捷键
  enable(): void {
    this.isEnabled = true;
  }

  // 禁用快捷键
  disable(): void {
    this.isEnabled = false;
  }

  // 添加处理器
  addHandler(handler: ShortcutHandler): void {
    this.handlers.push(handler);
  }

  // 移除处理器
  removeHandler(handler: ShortcutHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  // 初始化监听
  init(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  // 销毁监听
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }

  // 处理按键
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isEnabled) return;

    // 忽略输入框中的按键
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    this.pressedKeys.add(event.key);

    // 检查是否匹配快捷键
    const shortcut = this.matchShortcut(event);
    if (shortcut) {
      event.preventDefault();
      this.handlers.forEach((handler) => handler(shortcut.action, event));
    }
  };

  // 处理按键释放
  private handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.key);
  };

  // 匹配快捷键
  private matchShortcut(event: KeyboardEvent): Shortcut | null {
    return DEFAULT_SHORTCUTS.find((shortcut) => {
      // 检查主键
      if (shortcut.key !== event.key) return false;

      // 检查修饰键
      if (shortcut.ctrl !== undefined && shortcut.ctrl !== event.ctrlKey && shortcut.ctrl !== event.metaKey) return false;
      if (shortcut.shift !== undefined && shortcut.shift !== event.shiftKey) return false;
      if (shortcut.alt !== undefined && shortcut.alt !== event.altKey) return false;

      return true;
    }) || null;
  }

  // 获取当前按下的键
  getPressedKeys(): string[] {
    return Array.from(this.pressedKeys);
  }

  // 检查是否按下了某个键
  isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key);
  }

  // 获取快捷键列表
  getShortcuts(): Shortcut[] {
    return DEFAULT_SHORTCUTS;
  }

  // 格式化快捷键显示
  formatShortcut(shortcut: Shortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key);
    return parts.join('+');
  }
}

// 单例模式
let keyboardManager: KeyboardManager | null = null;

export const getKeyboardManager = (): KeyboardManager => {
  if (!keyboardManager) {
    keyboardManager = new KeyboardManager();
  }
  return keyboardManager;
};

export default KeyboardManager;
