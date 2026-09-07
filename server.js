const fs = require("fs");
const path = require("path");
const express = require("express");
const { chromium } = require("playwright");

const PORT = Number(process.env.PORT) || 3780;
const CORE_PATH = path.join(__dirname, "extract-core.js");

const app = express();
app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
    });
  }
  return browserPromise;
}

async function extractFromUrl(url) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    locale: "zh-CN",
    viewport: { width: 430, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("#js_content, .rich_media_content", {
      timeout: 20000,
    });

    await page.evaluate(async () => {
      const body = document.querySelector("#js_content, .rich_media_content");
      if (!body) return;
      const total = Math.max(document.body.scrollHeight, body.scrollHeight);
      for (let y = 0; y <= total; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
    });

    await page.addScriptTag({ content: fs.readFileSync(CORE_PATH, "utf8") });
    const result = await page.evaluate(() => window.MiniURLCut.extractFromDocument(document));
    if (!result.ok) {
      throw new Error(result.error);
    }
    return { ...result, url };
  } finally {
    await context.close();
  }
}

app.post("/api/extract", async (req, res) => {
  const url = String(req.body?.url || "").trim();
  if (!/^https:\/\/mp\.weixin\.qq\.com\//.test(url)) {
    res.status(400).json({ ok: false, error: "请提供 mp.weixin.qq.com 文章链接" });
    return;
  }

  try {
    const data = await extractFromUrl(url);
    res.json({ ok: true, ...data });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

function isAllowedImage(raw) {
  try {
    const target = new URL(raw);
    const host = target.hostname;
    return (
      host === "mmbiz.qpic.cn" ||
      host.endsWith(".qpic.cn") ||
      host.endsWith(".qlogo.cn") ||
      host.includes("mmbiz")
    );
  } catch {
    return false;
  }
}

app.get("/api/img", async (req, res) => {
  let target = String(req.query.url || "");
  const referer = String(req.query.referer || "https://mp.weixin.qq.com/");
  try {
    target = decodeURIComponent(target);
  } catch {
    // keep raw
  }
  target = target.replace(/&amp;/g, "&").split("#")[0];
  if (!isAllowedImage(target)) {
    res.status(400).end("blocked");
    return;
  }

  try {
    const response = await fetch(target, {
      headers: {
        Referer: referer.startsWith("https://mp.weixin.qq.com")
          ? referer
          : "https://mp.weixin.qq.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      res.status(response.status).end("fetch failed");
      return;
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (error) {
    res.status(502).end(error instanceof Error ? error.message : "proxy failed");
  }
});

app.listen(PORT, () => {
  console.log(`MiniURLCut local preview: http://127.0.0.1:${PORT}`);
});
