import { readFile, writeFile, mkdir } from "fs/promises";
import { createServer } from "http";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Render provides PORT in environment when deployed
const PORT = process.env.PORT || 3000;

// Ensure `data` folder always exists
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "links.json");
await mkdir(DATA_DIR, { recursive: true });

// Helper: Serve static files from /public folder
const serveStatic = async (req, res) => {
    const publicPath = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url);
    const ext = path.extname(publicPath).toLowerCase();

    const contentTypeMap = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg"
    };

    const contentType = contentTypeMap[ext] || "text/plain";

    try {
        const data = await readFile(publicPath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
        return true;
    } catch {
        return false;
    }
};

// Load JSON links (initialize if missing)
const loadLinks = async () => {
    try {
        const data = await readFile(DATA_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        await writeFile(DATA_FILE, JSON.stringify({}, null, 2));
        return {};
    }
};

// Save JSON links
const saveLinks = async (links) =>
    writeFile(DATA_FILE, JSON.stringify(links, null, 2));

const server = createServer(async (req, res) => {
    console.log(req.method, req.url);

    // Serve frontend UI from /public
    if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/public") || req.url.endsWith(".css") || req.url.endsWith(".js"))) {
        const served = await serveStatic(req, res);
        if (served) return;
    }

    // API Get all links
    if (req.method === "GET" && req.url === "/links") {
        const links = await loadLinks();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(links));
    }

    // Redirection handler for short codes
    if (req.method === "GET" && req.url.length > 1) {
        const code = req.url.slice(1);
        const links = await loadLinks();

        if (links[code]) {
            res.writeHead(302, { Location: links[code] });
            return res.end();
        }
    }

    // Create short URL
    if (req.method === "POST" && req.url === "/shorten") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));

        req.on("end", async () => {
            try {
                const { url, shortCode } = JSON.parse(body);

                if (!url) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("URL is required!");
                }

                const code = shortCode || crypto.randomBytes(4).toString("hex");
                const links = await loadLinks();

                if (links[code]) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("Short code already exists!");
                }

                links[code] = url;
                await saveLinks(links);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, shortCode: code }));
            } catch {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Invalid request format!");
            }
        });
        return;
    }

    // Fallback if route not found
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Page Not Found!");
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});