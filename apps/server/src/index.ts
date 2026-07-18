import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { investigateRepository } from "./investigation/investigateRepository.js";
import { scanRepository } from "./scanning/osvScanner.js";

export const serviceName = "PatchPilot orchestrator";
const root = process.cwd();
const webRoot = path.join(root, "apps/web/dist");
const demoRoot = path.join(root, "demo/vulnerable-node-app");
const port = Number(process.env.PORT ?? 4173);

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/demo/scan") {
    try {
      const result = await scanRepository({ repositoryPath: demoRoot });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Scan failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/investigate") {
    try {
      const result = await investigateRepository({ repositoryPath: demoRoot, projectRoot: root });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Investigation failed" }));
    }
    return;
  }

  const requestPath = request.url === "/" ? "/index.html" : (request.url ?? "/index.html");
  const filePath = path.resolve(webRoot, `.${requestPath}`);
  if (!filePath.startsWith(`${webRoot}${path.sep}`)) {
    response.writeHead(404).end();
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`PatchPilot Milestone 2: http://127.0.0.1:${port}`);
});
