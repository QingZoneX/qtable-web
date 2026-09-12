// IconManager.ts
// 用于管理图标预加载和缓存，解决VTable图标加载异常问题

interface IconConfig {
  name: string;
  svg: string;
}

class IconManager {
  private static instance: IconManager;
  private cache = new Map<string, string>();
  private loadedIcons = new Map<string, HTMLImageElement>();
  
  private constructor() {}

  static getInstance(): IconManager {
    if (!IconManager.instance) {
      IconManager.instance = new IconManager();
    }
    return IconManager.instance;
  }

  // 注册所有图标
  registerIcons(icons: IconConfig[]): void {
    for (const icon of icons) {
      this.registerIcon(icon.name, icon.svg);
    }
  }

  // 注册单个图标
  registerIcon(name: string, svg: string): void {
    if (this.cache.has(name)) return;
    
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    this.cache.set(name, dataUrl);
    
    // 预加载图片到内存，避免VTable渲染时闪烁
    const img = new Image();
    img.src = dataUrl;
    img.width = 16;
    img.height = 16;
    // 监听加载完成
    img.onload = () => {
      console.log(`Icon loaded: ${name}`);
    };
    this.loadedIcons.set(name, img);
  }

  // 获取图标的 data URL
  getDataUrl(name: string): string | undefined {
    return this.cache.get(name);
  }

  // 获取预加载的图片元素
  getImage(name: string): HTMLImageElement | undefined {
    return this.loadedIcons.get(name);
  }

  // 检查图标是否已加载完成
  isLoaded(name: string): boolean {
    const img = this.loadedIcons.get(name);
    return img?.complete === true;
  }

  // 等待所有图标加载完成
  waitForAllLoaded(): Promise<void> {
    const images = Array.from(this.loadedIcons.values());
    const loadPromises = images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // 即使加载失败也resolve
      });
    });
    return Promise.all(loadPromises).then(() => {});
  }

  // 清除缓存
  clear(): void {
    this.cache.clear();
    this.loadedIcons.clear();
  }
}

// 导出单例实例
export const iconManager = IconManager.getInstance();

// 批量注册工具函数
export const registerIcon = (name: string, svg: string): void => {
  iconManager.registerIcon(name, svg);
};

export const getDataUrl = (name: string): string | undefined => {
  return iconManager.getDataUrl(name);
};

export const getImage = (name: string): HTMLImageElement | undefined => {
  return iconManager.getImage(name);
};

// 导出 IconManager 类供高级使用
export { IconManager };

