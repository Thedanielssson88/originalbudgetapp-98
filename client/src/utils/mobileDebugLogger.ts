// Global debug logger for mobile debugging

interface DebugLog {
  timestamp: string;
  message: string;
}

class MobileDebugLogger {
  private logs: DebugLog[] = [];
  private listeners: ((logs: DebugLog[]) => void)[] = [];

  addLog(message: string) {
    // Skip logging in production for performance
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry: DebugLog = { timestamp, message };
    
    // Keep only last 400 messages to prevent memory issues
    this.logs = [...this.logs.slice(-399), logEntry];
    
    // Also log to console (only in development)
    console.log(`${timestamp}: ${message}`);
    
    // Notify all listeners
    this.listeners.forEach(listener => listener(this.logs));
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

// Enhanced logging with severity levels and data
export const addLog = (level: 'info' | 'error' | 'warn', message: string, data?: any) => {
  const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  const fullMessage = data ? `${emoji} ${message} - ${JSON.stringify(data)}` : `${emoji} ${message}`;
  mobileDebugLogger.addLog(fullMessage);
};
