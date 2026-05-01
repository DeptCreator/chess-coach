import { createServer } from "node:http";
import next from "next";

const args = process.argv.slice(2);
const port = Number(readArg("--port") ?? process.env.PORT ?? 3000);
const hostname = readArg("--hostname") ?? process.env.HOSTNAME ?? "127.0.0.1";
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();
const handleUpgrade = app.getUpgradeHandler();

const server = createServer((request, response) => {
  handle(request, response);
});

server.on("upgrade", (request, socket, head) => {
  handleUpgrade(request, socket, head);
});

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}
