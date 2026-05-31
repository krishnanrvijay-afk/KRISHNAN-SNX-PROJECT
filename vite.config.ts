import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// Dev proxy: MEXC contract API (Binance is geo-restricted from Replit servers;
// Railway uses Binance via server.js — prices are equivalent between exchanges).
// NOTE: multi_pair_scanner.html pre-maps symbols via its own MEXC_SYM table
// (e.g. FILUSDT→FILECOIN_USDT, XRPUSDT→XRP_USDT). The proxy must pass the
// symbol through as-is; any server-side remapping produces double-underscore
// symbols like FILECOIN__USDT that MEXC rejects with "Contract does not exist".

const mexcProxyPlugin = {
  name: "mexc-proxy",
  configureServer(server: import("vite").ViteDevServer) {
    // Use a single top-level middleware and check the full req.url ourselves.
    // Path-prefixed .use('/path', fn) strips the prefix from req.url inside the
    // handler, making query-string extraction unreliable across Vite versions.
    server.middlewares.use(
      async (
        req: import("http").IncomingMessage,
        res: import("http").ServerResponse,
        next: () => void,
      ) => {
        const fullUrl = req.url || "";

        if (fullUrl.startsWith("/proxy/mexc/kline")) {
          try {
            const p        = new URLSearchParams(fullUrl.split("?")[1] || "");
            const symbol   = p.get("symbol") || "";
            const interval = p.get("interval") || "Min1";
            const limit    = p.get("limit") || "25";
            const r = await fetch(
              `https://contract.mexc.com/api/v1/contract/kline/${symbol}?interval=${interval}&limit=${limit}`,
              { signal: AbortSignal.timeout(10000) },
            );
            const data = await r.json();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify(data));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: String(e) }));
          }
          return;
        }

        if (fullUrl.startsWith("/proxy/mexc/depth")) {
          try {
            const p      = new URLSearchParams(fullUrl.split("?")[1] || "");
            const symbol = p.get("symbol") || "";
            const limit  = p.get("limit") || "10";
            const r = await fetch(
              `https://contract.mexc.com/api/v1/contract/depth/${symbol}?limit=${limit}`,
              { signal: AbortSignal.timeout(10000) },
            );
            const data = await r.json();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify(data));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: String(e) }));
          }
          return;
        }

        next();
      },
    );
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    mexcProxyPlugin,
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
