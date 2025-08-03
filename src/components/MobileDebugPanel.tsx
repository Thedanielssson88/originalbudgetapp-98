import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mobileDebugLogger } from '@/utils/mobileDebugLogger';
import { X, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface DebugLog {
  timestamp: string;
  message: string;
}

export const MobileDebugPanel: React.FC = () => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Initialize with existing logs
    setLogs(mobileDebugLogger.getLogs());
    
    // Subscribe to new logs
    const unsubscribe = mobileDebugLogger.subscribe(setLogs);
    
    return unsubscribe;
  }, []);

  const handleClearLogs = () => {
    mobileDebugLogger.clearLogs();
  };

  const formatLogMessage = (message: string) => {
    // Color-code different types of messages
    if (message.includes('📅')) return 'text-blue-600';
    if (message.includes('🔍')) return 'text-green-600';
    if (message.includes('REMOVE')) return 'text-red-600';
    if (message.includes('KEEP')) return 'text-green-600';
    if (message.includes('ERROR') || message.includes('❌')) return 'text-red-600';
    if (message.includes('⚠️')) return 'text-yellow-600';
    return 'text-gray-700';
  };

  if (!isOpen) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button 
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
          className="bg-white shadow-lg"
        >
          Debug Logs
          {logs.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {logs.length}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed top-4 right-4 z-50 w-80 bg-white border rounded-lg shadow-lg ${isMinimized ? 'h-12' : 'h-96'}`}>
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Debug Logs</h3>
          {logs.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {logs.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setIsMinimized(!isMinimized)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            {isMinimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button
            onClick={handleClearLogs}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={logs.length === 0}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {!isMinimized && (
        <ScrollArea className="h-80 p-3">
          {logs.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">
              No debug logs yet
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="text-xs">
                  <div className="text-gray-400 mb-1">{log.timestamp}</div>
                  <div className={`font-mono break-words ${formatLogMessage(log.message)}`}>
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
};