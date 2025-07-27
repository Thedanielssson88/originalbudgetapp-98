// Global debug logger for mobile debugging

interface DebugLog {
  timestamp: string;
  message: string;
}

class MobileDebugLogger {
  private logs: DebugLog[] = [];
  private listeners: ((logs: DebugLog[]) => void)[] = [];

  addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry: DebugLog = { timestamp, message };
    
    // Keep only last 20 messages to prevent memory issues
    this.logs = [...this.logs.slice(-19), logEntry];
    
    // Also log to console
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
