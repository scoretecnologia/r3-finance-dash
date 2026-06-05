import fs from "fs";
import path from "path";

const vercelOutput = ".vercel/output";
fs.rmSync(vercelOutput, { recursive: true, force: true });
fs.mkdirSync(path.join(vercelOutput, "static"), { recursive: true });
fs.cpSync("dist/client", path.join(vercelOutput, "static"), { recursive: true });

fs.mkdirSync(path.join(vercelOutput, "functions", "index.func"), { recursive: true });
fs.cpSync("dist/server", path.join(vercelOutput, "functions", "index.func", "dist", "server"), { recursive: true });

const handlerCode = `
import server from "./dist/server/server.js";

export default async function(req, res) {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const url = new URL(req.url, \`\${protocol}://\${host}\`);
    
    const webReq = new Request(url.href, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body || {}),
    });

    const webRes = await server.fetch(webReq);
    
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    res.status(webRes.status);
    
    const buffer = await webRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      error: "FUNCTION_INVOCATION_FAILED (Custom Wrapper)", 
      message: error.message, 
      stack: error.stack 
    });
  }
}
`;

fs.writeFileSync(path.join(vercelOutput, "functions", "index.func", "index.js"), handlerCode);
fs.writeFileSync(path.join(vercelOutput, "functions", "index.func", "package.json"), JSON.stringify({ type: "module" }));
fs.writeFileSync(path.join(vercelOutput, "functions", "index.func", ".vc-config.json"), JSON.stringify({
  runtime: "nodejs20.x",
  handler: "index.js",
  launcherType: "Nodejs"
}));

fs.writeFileSync(path.join(vercelOutput, "config.json"), JSON.stringify({
  version: 3,
  routes: [
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/index" }
  ]
}));

console.log("Vercel output created successfully!");
