import crypto from "crypto";

/**
 * Attaches/propagates X-Request-Id and emits structured JSON request logs
 * without ever recording Authorization headers, cookies, or request bodies
 * (audit P2-07 & Phase 5 observability).
 */
export function createErpObservabilityMiddleware(service = "mmpz-erp-api") {
  return (req, res, next) => {
    const incoming = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"].trim() : "";
    const requestId =
      incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming)
        ? incoming
        : crypto.randomUUID();
    res.setHeader("X-Request-Id", requestId);

    const start = process.hrtime.bigint();
    res.on("finish", () => {
      if (process.env.NODE_ENV === "test") return;
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const entry = {
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
        service,
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      };
      process.stdout.write(`${JSON.stringify(entry)}\n`);
    });

    next();
  };
}
