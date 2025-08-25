import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-config" });

// UI Layer Configuration
export const DEFAULT_UI_LAYERS = {
  canvas: { zIndex: 1, pointerEvents: 'auto' },
  ui: { zIndex: 1000, pointerEvents: 'none' },
  modeIndicator: { zIndex: 1001, pointerEvents: 'auto' },
  viewIndicator: { zIndex: 1001, pointerEvents: 'auto' },
  infoPanel: { zIndex: 1001, pointerEvents: 'auto' },
  frameIndicator: { zIndex: 1001, pointerEvents: 'auto' }
};

// Responsive Breakpoint Configuration
export const DEFAULT_BREAKPOINTS = {
  xs: 480,
  sm: 768,
  md: 1024,
  lg: 1200,
  xl: 1400
};

// UI Component Configuration
export const DEFAULT_UI_COMPONENTS = {
  showModeIndicator: true,
  showViewIndicator: true,
  showInfoPanel: true,
  showFrameIndicator: true
};

// Render Configuration
export const DEFAULT_RENDER_CONFIG = {
  fitContainer: true,
  autoRenderResolution: true,
  minPixelRatio: 0.5,
  maxPixelRatio: 3.0
};

// Performance Configuration
export const DEFAULT_PERFORMANCE_CONFIG = {
  debounceDelay: 100,      // Resize debounce delay
  throttleLimit: 16,       // Resize throttle limit (~60fps)
  maxResizeObservers: 10,  // Maximum resize observers count
  cleanupTimeout: 5000     // Cleanup timeout
};

// Event Configuration
export const DEFAULT_EVENT_CONFIG = {
  preventPropagation: true,
  stopImmediatePropagation: false,
  capturePhase: false
};

// Debug Configuration
export const DEFAULT_DEBUG_CONFIG = {
  enabled: false,
  logLevel: 'info',
  showPerformanceMetrics: false
};

// Environment Configuration
export const DEFAULT_ENVIRONMENT_CONFIG = {
  isJupyter: typeof window !== 'undefined' && window.location.href.includes('jupyter'),
  isNotebook: typeof window !== 'undefined' && window.location.href.includes('notebook'),
  isLab: typeof window !== 'undefined' && window.location.href.includes('lab')
};

// Theme Configuration
export const DEFAULT_THEME_CONFIG = {
  currentTheme: 'auto',
  themes: {
    light: {
      background: '#ffffff',
      foreground: '#000000',
      primary: '#007acc',
      secondary: '#6c757d',
      accent: '#28a745'
    },
    dark: {
      background: '#1e1e1e',
      foreground: '#ffffff',
      primary: '#007acc',
      secondary: '#6c757d',
      accent: '#28a745'
    }
  }
};

export interface MolvisConfig {
  // Display settings
  displayWidth: number;
  displayHeight: number;
  fitContainer: boolean;
  
  // Render settings
  autoRenderResolution: boolean;
  renderWidth?: number;
  renderHeight?: number;
  pixelRatio: number;
  
  // UI settings
  showUI: boolean;
  uiComponents: UIConfig;
  
  // Performance settings
  enableVSync: boolean;
  enableMSAA: boolean;
  maxFPS: number;
}

export interface UIConfig {
  showModeIndicator: boolean;
  showViewIndicator: boolean;
  showInfoPanel: boolean;
  showFrameIndicator: boolean;
}

export const DEFAULT_CONFIG: MolvisConfig = {
  displayWidth: 800,
  displayHeight: 600,
  fitContainer: true,
  
  autoRenderResolution: true,
  pixelRatio: window.devicePixelRatio || 1,
  
  showUI: true,
  uiComponents: {
    showModeIndicator: true,
    showViewIndicator: true,
    showInfoPanel: true,
    showFrameIndicator: true,
  },
  
  enableVSync: true,
  enableMSAA: true,
  maxFPS: 60,
};

export class ConfigManager {
  private config: MolvisConfig;
  
  constructor(initialConfig: Partial<MolvisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...initialConfig };
  }
  
  get<K extends keyof MolvisConfig>(key: K): MolvisConfig[K] {
    return this.config[key];
  }
  
  set<K extends keyof MolvisConfig>(key: K, value: MolvisConfig[K]): void {
    this.config[key] = value;
  }
  
  update(updates: Partial<MolvisConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  getConfig(): MolvisConfig {
    return { ...this.config };
  }
}

// Theme Manager Class
export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: string;

  private constructor() {
    this.currentTheme = this.detectSystemTheme();
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private detectSystemTheme(): string {
    // Detect system theme preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      return darkModeQuery.matches ? 'dark' : 'light';
    }
    return 'light';
  }

  public getCurrentTheme(): string {
    return this.currentTheme;
  }

  public setTheme(theme: string): void {
    if (['light', 'dark', 'auto'].includes(theme)) {
      this.currentTheme = theme === 'auto' ? this.detectSystemTheme() : theme;
      logger.info(`Theme changed to: ${this.currentTheme}`);
    } else {
      logger.warn(`Invalid theme: ${theme}`);
    }
  }

  public getThemeColors(theme?: string): any {
    const targetTheme = theme || this.currentTheme;
    return DEFAULT_THEME_CONFIG.themes[targetTheme as keyof typeof DEFAULT_THEME_CONFIG.themes] || DEFAULT_THEME_CONFIG.themes.light;
  }

  public toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    logger.info(`Theme toggled to: ${this.currentTheme}`);
  }
}

// Export configuration constants and managers
export const CONFIG = {
  widget: {
    DEFAULT_UI_LAYERS,
    DEFAULT_BREAKPOINTS,
    DEFAULT_UI_COMPONENTS,
    RENDER_CONFIG: DEFAULT_RENDER_CONFIG,
    PERFORMANCE_CONFIG: DEFAULT_PERFORMANCE_CONFIG
  },
  events: DEFAULT_EVENT_CONFIG,
  debug: DEFAULT_DEBUG_CONFIG,
  environment: DEFAULT_ENVIRONMENT_CONFIG,
  theme: ThemeManager.getInstance()
};
