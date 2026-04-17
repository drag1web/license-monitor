const http = require("http");

const url = process.argv[2] || "http://localhost:5173";
const timeoutMs = Number(process.argv[3] || 30000);
const start = Date.now();

function ping() {
  const req = http.get(url, (res) => {
    res.resume();
    process.exit(0);
  });

  req.on("error", () => {
    if (Date.now() - start > timeoutMs) {
      console.error("Timeout waiting for:", url);
      process.exit(1);
    }
    setTimeout(ping, 250);
  });
}

ping();
