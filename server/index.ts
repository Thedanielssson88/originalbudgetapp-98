import express, { type Request, Response, NextFunction } from "express";
import { config } from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Load environment variables from .env file
config();

// Auto-configure environment based on deployment context
function configureEnvironment() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const replId = process.env.REPL_ID || '';
  const currentDomain = process.env.REPLIT_DB_URL || '';
  
  // Detect if we're in production based on various signals
  const isProduction = process.env.NODE_ENV === 'production' || 
                      currentDomain.includes('originalbudgetapp-98-andreasadaniels.replit.app') ||
                      replId.includes('originalbudgetapp');

  console.log('🔍 Environment detection:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('REPL_ID:', replId);
  console.log('Is Production:', isProduction);
  
  if (isProduction) {
    // Production environment - use EU database
    console.log('🚀 Configuring PRODUCTION environment');
    process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    process.env.VITE_STACK_PROJECT_ID = '9dcd4abe-925d-423b-ac64-d208074f0f61';
    process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY = 'pck_mffzj51gqpjeargacr5nth5j1hc2cn2y2weq600h7g5m8';
    process.env.STACK_SECRET_SERVER_KEY = 'ssk_91t6ztvrjcqqgzdzbyyjdsz30cvbxvp3as5bfbnwr6v98';
  } else {
    // Development environment - use US database
    console.log('🔧 Configuring DEVELOPMENT environment');
    process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_csIURKah4TN5@ep-soft-salad-aeyhh2aj.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
    process.env.VITE_STACK_PROJECT_ID = '9dcd4abe-925d-423b-ac64-d208074f0f61';
    process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY = 'pck_2bq4y4eh5jjet23y21xvxxy44nxqza78y544g0y6fwzzr';
    process.env.STACK_SECRET_SERVER_KEY = 'ssk_hraz04g3jmhzp72ts1nkjw17bda7rdgp7mqk0338jyy8g';
  }
  
  console.log('Database configured for:', isProduction ? 'PRODUCTION (EU)' : 'DEVELOPMENT (US)');
}

// Configure environment before anything else
configureEnvironment();

// Debug environment variables
console.log('🔍 Final environment configuration:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
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
