import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { validateEnv } from "./config/env";
import { validatePlatformConfigurations } from "./utils/platform-config-validator";
import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";

// Validate environment variables on startup
validateEnv();

// Validate and log platform configurations
validatePlatformConfigurations();

const app = express();

// Trust proxy for cookie-based auth (required for secure cookies behind load balancer)
app.set("trust proxy", 1);

// Configure Pino logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "HH:MM:ss",
          },
        }
      : undefined,
});

// HTTP request logging with Pino
app.use(
  pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers['x-api-key']",
        "res.headers['set-cookie']",
      ],
      remove: true,
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
  })
);

// Security headers with Helmet
// Production headers include: X-Content-Type-Options, CSP, HSTS, X-Frame-Options, etc.
// CSP is disabled in development to allow Vite HMR (hot module reload)
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", "data:"], // Allow data: URIs for inline images
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for styled components
              connectSrc: ["'self'"],
            },
          }
        : false, // Disable CSP in development for hot reload
  })
);

// CORS - support comma-separated allowlist, no wildcards in production
const corsOrigin = process.env.CORS_ORIGIN;
const allowedOrigins = corsOrigin 
  ? corsOrigin.split(",").map(origin => origin.trim())
  : [];

// Block wildcard in production
if (process.env.NODE_ENV === "production" && allowedOrigins.includes("*")) {
  throw new Error("Wildcard (*) CORS origin not allowed in production");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowlist
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

// Cookie parser (before routes)
app.use(cookieParser());

// parse JSON first
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

// Public test route (after body parsers; before registerRoutes/setupVite/serveStatic)
app.post("/post_to_fb", (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message : "";
  return res.json({ success: true, echo: message });
});

(async () => {
  console.log("🚀 Starting server initialization...");
  console.log("📊 Environment:", process.env.NODE_ENV);
  console.log("🔗 DATABASE_URL exists:", !!process.env.DATABASE_URL);
  
  let server;
  try {
    console.log("📝 Registering routes...");
    server = await registerRoutes(app);
    console.log("✅ Routes registered successfully");
  } catch (error) {
    console.error("❌ Failed to register routes:", error);
    process.exit(1);
  }

  // Centralized error handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = (req as any).id || "unknown";

    // Log error with request context
    req.log?.error(
      {
        err,
        requestId,
        status,
        path: req.path,
        method: req.method,
      },
      "Request error"
    );

    // Return clean error response
    const errorResponse: any = {
      code: status,
      message: status >= 500 && process.env.NODE_ENV === "production" 
        ? "Internal Server Error" 
        : message,
      requestId,
    };

    // Include stack trace only in development
    if (process.env.NODE_ENV === "development" && err.stack) {
      errorResponse.stack = err.stack;
    }

    res.status(status).json(errorResponse);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
