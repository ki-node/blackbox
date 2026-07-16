import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, relative, resolve } from "node:path";

const port = Number(process.env.PORT ?? 4174);
const mountPath = "/fixtures/deep/orbit/projects/blackbox/";
const root = resolve("dist-embedded");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

/**
 * Resolves one mounted request without allowing path traversal.
 */
function resolveRequest(pathname) {
  const requestPath = pathname.slice(mountPath.length) || "index.html";
  const path = resolve(join(root, requestPath));
  if (relative(root, path).startsWith("..")) return undefined;
  return path;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (!url.pathname.startsWith(mountPath)) {
    response.writeHead(404).end("Not found");
    return;
  }

  const path = resolveRequest(url.pathname);
  if (!path) {
    response.writeHead(400).end("Invalid path");
    return;
  }

  try {
    const file = (await stat(path)).isDirectory()
      ? join(path, "index.html")
      : path;
    await stat(file);
    response.writeHead(200, {
      "content-type": contentTypes[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Embedded build served at http://127.0.0.1:${port}${mountPath}`);
});
