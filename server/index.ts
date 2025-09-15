import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes, seedDatabase } from "./routes";
import { setupVite, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

  if (app.get("env") === "development") {
    // In dev, run Vite for HMR
    await setupVite(app, server);
  } else {
    // In production (Vercel), serve built React app
    const clientDist = path.join(__dirname, "..", "client", "dist", "public");
    console.log("Serving static from:", clientDist);

    app.use(express.static(clientDist));

    // Catch-all for non-API routes → React index.html
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(clientDist, "index.html"), (err) => {
        if (err) {
          console.error("Error sending index.html", err);
          res.status(500).send("Server error");
        }
      });
    });
  }

  // Serve API + client on same port
  const port = parseInt(process.env.PORT || '5000', 10);
  const listenOptions: any = { port, host: "0.0.0.0" };
  if (process.platform !== 'win32') {
    listenOptions.reusePort = true;
  }
  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });

  // Optionally run DB seed
  if (process.env.SEED_DB === 'true') {
    (async () => {
      try {
        console.log('SEED_DB=true — seeding database now...');
        await seedDatabase();
        console.log('Seeding complete.');
      } catch (e) {
        console.error('Seeding failed:', e);
      }
    })();
  }
})();
