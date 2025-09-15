import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes, seedDatabase } from "./routes";
import { setupVite, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Export the app for Vercel
export default app;

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const pathUrl = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathUrl.startsWith("/api")) {
      let logLine = `${req.method} ${pathUrl} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try { logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`; } catch {}
      }
      if (logLine.length > 240) {
        logLine = logLine.slice(0, 239) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";
  res.status(status).json({ message });
  console.error("Unhandled error:", err);
});

async function init() {
  const server = await registerRoutes(app);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    const clientDist = path.join(__dirname, "..", "dist", "public");
    console.log("Serving static from:", clientDist);

    app.use(express.static(clientDist));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(clientDist, "index.html"), (err) => {
        if (err) {
          console.error("Error sending index.html", err);
          res.status(500).send("Server error");
        }
      });
    });
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  if (!(process.env.VERCEL === "1" || process.env.VERCEL === "true")) {
    const listenOptions: any = { port, host: "0.0.0.0" };
    if (process.platform !== "win32") listenOptions.reusePort = true;

    server.listen(listenOptions, () => {
      log(`serving on port ${port}`);
    });

    if (process.env.SEED_DB === "true") {
      try {
        console.log("SEED_DB=true — seeding database...");
        await seedDatabase();
        console.log("Seeding complete.");
      } catch (e) {
        console.error("Seeding failed:", e);
      }
    }
  } else {
    log("Running in Vercel serverless mode (export only, no listen).");
  }
}

init().catch((err) => {
  console.error("Failed to init server:", err);
  if (!(process.env.VERCEL === "1" || process.env.VERCEL === "true")) {
    process.exit(1);
  }
});
