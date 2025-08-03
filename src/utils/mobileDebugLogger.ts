// Global debug logger for mobile debugging

interface DebugLog {
  timestamp: string;
  message: string;
}

class MobileDebugLogger {
  private logs: DebugLog[] = [];
  private listeners: ((logs: DebugLog[]) => void)[] = [];
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
    };

    // Intercept all console methods
    this.interceptConsole();
  }

  private interceptConsole() {
    console.log = (...args: any[]) => {
      this.addLogInternal('LOG: ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
      this.originalConsole.log(...args);
    };

    console.error = (...args: any[]) => {
      this.addLogInternal('ERROR: ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
      this.originalConsole.error(...args);
    };

    console.warn = (...args: any[]) => {
      this.addLogInternal('WARN: ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
      this.originalConsole.warn(...args);
    };

    console.info = (...args: any[]) => {
      this.addLogInternal('INFO: ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
      this.originalConsole.info(...args);
    };
  }

  private addLogInternal(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry: DebugLog = { timestamp, message };
    
    // Keep only last 50 messages to prevent memory issues
    this.logs = [...this.logs.slice(-49), logEntry];
    
    // Notify all listeners
    this.listeners.forEach(listener => listener(this.logs));
  }

  addLog(message: string) {
    this.addLogInternal('CUSTOM: ' + message);
  }

  getLogs(): DebugLog[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    this.listeners.forEach(listener => listener(this.logs));
  }

  subscribe(listener: (logs: DebugLog[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const mobileDebugLogger = new MobileDebugLogger();

// Helper function for easy logging
export const addMobileDebugLog = (message: string) => {
  mobileDebugLogger.addLog(message);
};
