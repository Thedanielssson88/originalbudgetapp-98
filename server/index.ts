import express, { type Request, Response, NextFunction } from "express";
import { config } from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Load environment variables from .env file
config();

// Debug environment variables
console.log('🔍 Environment variables loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VITE_STACK_PROJECT_ID:', process.env.VITE_STACK_PROJECT_ID ? 'Set' : 'Missing');
console.log('VITE_STACK_PUBLISHABLE_CLIENT_KEY:', process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ? 'Set' : 'Missing');

const app = express();
// Increase body size limit for large transaction synchronization requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use environment variable or default to 5000
  let port = parseInt(process.env.PORT || '5000');
  
  const tryStartServer = (currentPort: number) => {
    server.listen(currentPort, "0.0.0.0", () => {
      log(`serving on port ${currentPort}`);
    });
    
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        if (currentPort < 5010) {
          log(`Port ${currentPort} is in use, trying ${currentPort + 1}`);
          server.removeAllListeners('error');
          tryStartServer(currentPort + 1);
        } else {
          log(`All ports from 5000-5010 are in use`);
          process.exit(1);
        }
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
  };
  
  tryStartServer(port);
})();
