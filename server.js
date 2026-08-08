import { serve, file } from "bun";
import { generateDataIndex } from "./scripts/data-index.js";

const PORT = 3000;

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    if (path === "/" || path === "") {
      path = "/index.html";
    }

    if (path === "/data/index.json") {
      return new Response(JSON.stringify(generateDataIndex()), {
        headers: { "content-type": "application/json" }
      });
    }

    const filePath = `.${path}`;

    try {
      const f = file(filePath);
      const exists = await f.exists();
      if (!exists) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(f);
    } catch {
      return new Response("Internal Error", { status: 500 });
    }
  }
});

console.log(`Dev server running at http://localhost:${PORT}`);
