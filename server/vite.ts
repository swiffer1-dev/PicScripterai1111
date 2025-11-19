import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

// --- Proper ESM dirname shim (instead of import.meta.dirname) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---------------------------------------------------------------

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk in case it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production, compiled code is in dist/
  // Static files are in dist/public/
  // Try multiple possible paths
  let distPath = path.resolve(__dirname, "public");
  
  // If primary path doesn't exist, try from process.cwd()
  if (!fs.existsSync(distPath)) {
    console.log(`⚠️  Primary path not found: ${distPath}`);
    distPath = path.resolve(process.cwd(), "dist", "public");
    console.log(`   Trying alternative: ${distPath}`);
  }

  if (!fs.existsSync(distPath)) {
    // Log the attempted paths for debugging
    console.error(`❌ Build directory not found!`);
    console.error(`   Tried: ${path.resolve(__dirname, "public")}`);
    console.error(`   Tried: ${path.resolve(process.cwd(), "dist", "public")}`);
    console.error(`   Current __dirname: ${__dirname}`);
    console.error(`   Current cwd: ${process.cwd()}`);
    
    // List what's actually in the directories
    try {
      console.error(`   Contents of __dirname:`, fs.readdirSync(__dirname));
      console.error(`   Contents of cwd:`, fs.readdirSync(process.cwd()));
    } catch (err) {
      console.error(`   Could not list directories:`, err);
    }
    
    throw new Error(
      `Could not find the build directory, make sure to build the client first`,
    );
  }

  console.log(`✅ Serving static files from: ${distPath}`);
  
  // Log what files are available
  try {
    const files = fs.readdirSync(distPath);
    console.log(`   Files in dist: ${files.join(", ")}`);
    if (files.includes("assets")) {
      const assets = fs.readdirSync(path.join(distPath, "assets"));
      console.log(`   Assets count: ${assets.length}`);
    }
  } catch (err) {
    console.error(`   Could not list files:`, err);
  }

  // Serve static assets from the Vite build
  app.use(express.static(distPath, {
    maxAge: "1d",
    etag: true,
    lastModified: true,
  }));

  // Fallback: always send index.html for any unmatched route
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
