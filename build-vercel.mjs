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
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const url = new URL(req.url, \`\${protocol}://\${req.headers.host}\`);
  
  const webReq = new Request(url.href, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
    duplex: "half"
  });

  const webRes = await server.fetch(webReq);
  
  webRes.headers.forEach((v, k) => res.setHeader(k, v));
  res.status(webRes.status);
  
  const buffer = await webRes.arrayBuffer();
  res.send(Buffer.from(buffer));
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
