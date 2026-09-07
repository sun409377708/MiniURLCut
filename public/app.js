const state = {
  url: "",
  html: "",
  text: "",
  blocks: [],
  start: null,
  end: null,
  anchor: null,
  tab: "formatted",
};

const els = {
  url: document.getElementById("url"),
  extractBtn: document.getElementById("extractBtn"),
  downloadHtmlBtn: document.getElementById("downloadHtmlBtn"),
  downloadTxtBtn: document.getElementById("downloadTxtBtn"),
  fullBtn: document.getElementById("fullBtn"),
  status: document.getElementById("status"),
  blockList: document.getElementById("blockList"),
  rangeMeta: document.getElementById("rangeMeta"),
  previewMeta: document.getElementById("previewMeta"),
  formattedView: document.getElementById("formattedView"),
  textView: document.getElementById("textView"),
};

function setStatus(text) {
  els.status.textContent = text;
}

function decodeHtmlAttr(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function rewriteImages(html, referer) {
  const origin = window.location.origin;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch =
      tag.match(/\sdata-src=["']([^"']+)["']/i) ||
      tag.match(/\ssrc=["']([^"']+)["']/i);
    if (!srcMatch) return tag;
    const raw = decodeHtmlAttr(srcMatch[1]).split("#")[0];
    if (!/^https?:\/\//.test(raw)) return tag;
    const proxied = `${origin}/api/img?url=${encodeURIComponent(raw)}&referer=${encodeURIComponent(referer)}`;
    if (/\ssrc=/i.test(tag)) {
      return tag.replace(/\ssrc=["'][^"']*["']/i, ` src="${proxied}"`);
    }
    return tag.replace(/<img/i, `<img src="${proxied}"`);
  });
}

function selectedRange() {
  if (state.start == null || state.end == null) return null;
  return {
    lo: Math.min(state.start, state.end),
    hi: Math.max(state.start, state.end),
  };
}

function currentSlice() {
  if (!state.blocks.length) {
    return { html: "", text: "" };
  }
  const range = selectedRange();
  if (!range) {
    return { html: state.html, text: state.text };
  }
  const sliced = state.blocks.slice(range.lo, range.hi + 1);
  return {
    html: sliced.map((block) => block.html).join(""),
    text: sliced.map((block) => block.text).filter(Boolean).join("\n\n"),
    start: range.lo,
    end: range.hi,
  };
}

function wrapDownloadDocument(html) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>正文</title>
  <style>
    html, body { margin: 0; background: #fff; }
    body { padding: 24px 0 48px; }
    .rich_media_content {
      max-width: 677px;
      margin: 0 auto;
      padding: 0 16px;
      color: #3e3e3e;
      font-size: 17px;
      line-height: 1.75;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      text-align: center;
      overflow: hidden;
    }
    .rich_media_content img,
    .rich_media_content video {
      max-width: 100%;
      height: auto;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <div class="rich_media_content">${html}</div>
</body>
</html>`;
}

function wrapPreviewDocument(referer) {
  const range = selectedRange();
  const cards = state.blocks
    .map((block, index) => {
      const selected = range && index >= range.lo && index <= range.hi;
      const dimmed = Boolean(range) && !selected;
      const cls = ["card", selected ? "is-selected" : "", dimmed ? "is-dimmed" : ""]
        .filter(Boolean)
        .join(" ");
      return `<article class="${cls}" id="block-${index}">
        <div class="card-tag">#${index + 1}</div>
        <div class="card-body">${rewriteImages(block.html, referer)}</div>
      </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>正文预览</title>
  <style>
    html, body {
      margin: 0;
      background: #d8d2c6;
      max-width: 100%;
      overflow-x: hidden;
    }
    body {
      padding: 14px 14px 36px;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #3e3e3e;
      line-height: 1.75;
    }
    .card {
      position: relative;
      background: #fff;
      border: 1px solid #b9b1a4;
      border-radius: 10px;
      margin: 0 0 14px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    .card.is-selected {
      border: 2px solid #c48a12;
      box-shadow: 0 0 0 3px rgba(196, 138, 18, 0.28);
    }
    .card.is-dimmed { opacity: 0.36; }
    .card-tag {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 2;
      background: #3a342c;
      color: #fff;
      font-size: 11px;
      line-height: 1;
      padding: 5px 7px;
      border-radius: 999px;
    }
    .card.is-selected .card-tag { background: #c48a12; }
    .card-body {
      padding: 34px 16px 16px;
      min-width: 0;
      text-align: center;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .card-body, .card-body * {
      max-width: 100% !important;
      min-width: 0 !important;
      white-space: normal !important;
      box-sizing: border-box !important;
    }
    .card-body section,
    .card-body p,
    .card-body span {
      display: block !important;
      width: auto !important;
      height: auto !important;
      line-height: 1.7 !important;
      overflow: visible !important;
    }
    .card-body img, .card-body video {
      max-width: 100% !important;
      height: auto !important;
      display: inline-block !important;
      margin: 0 auto;
      vertical-align: middle;
    }
  </style>
</head>
<body>${cards}</body>
</html>`;
}

function renderBlocks() {
  els.blockList.innerHTML = "";
  const a = state.start;
  const b = state.end;
  const lo = a == null || b == null ? null : Math.min(a, b);
  const hi = a == null || b == null ? null : Math.max(a, b);

  state.blocks.forEach((block, index) => {
    const li = document.createElement("li");
    li.className = "block";
    if (index === a) li.classList.add("start");
    if (index === b) li.classList.add("end");
    if (lo != null && index >= lo && index <= hi) li.classList.add("in-range");
    const hasImg = /<img/i.test(block.html);
    const preview = (block.text || "")
      .replace(/\[图片[^\]]*\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 72);
    const label = preview || (hasImg ? "图片" : "空块");
    li.innerHTML = `<span class="block-index">#${index + 1}</span>${label}`;
    li.addEventListener("click", (event) => selectBlock(index, event));
    els.blockList.appendChild(li);
  });

  if (lo == null) {
    els.rangeMeta.textContent = `共 ${state.blocks.length} 块，当前为全文`;
  } else if (lo === hi) {
    els.rangeMeta.textContent = `已选第 ${lo + 1} 块`;
  } else {
    els.rangeMeta.textContent = `已选第 ${lo + 1}–${hi + 1} 块`;
  }
  els.fullBtn.disabled = !state.blocks.length;
}

function renderPreview() {
  const slice = currentSlice();
  els.formattedView.srcdoc = wrapPreviewDocument(state.url);
  els.textView.textContent = slice.html || "当前范围没有内容。";
  els.previewMeta.textContent = slice.html ? `HTML ${slice.html.length} 字符` : "";
  els.downloadHtmlBtn.disabled = !slice.html;
  els.downloadTxtBtn.disabled = !slice.html;
}

function selectBlock(index, event) {
  if (event?.shiftKey && state.anchor != null) {
    state.start = state.anchor;
    state.end = index;
  } else {
    state.anchor = index;
    state.start = index;
    state.end = index;
  }
  renderBlocks();
  renderPreview();
}

function showFullArticle() {
  state.anchor = null;
  state.start = null;
  state.end = null;
  renderBlocks();
  renderPreview();
}

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  els.formattedView.classList.toggle("hidden", tab !== "formatted");
  els.textView.classList.toggle("hidden", tab !== "text");
}

function fileBaseName() {
  try {
    const slug = new URL(state.url).pathname.split("/").filter(Boolean).pop();
    return (slug || "article").replace(/[^\w.-]+/g, "_");
  } catch {
    return "article";
  }
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function downloadHtml() {
  const slice = currentSlice();
  if (!slice.html) {
    setStatus("没有可下载的 HTML");
    return;
  }
  const name = `${fileBaseName()}.html`;
  downloadFile(name, wrapDownloadDocument(slice.html), "text/html;charset=utf-8");
  setStatus(`已下载 ${name}`);
}

function downloadTxt() {
  const html = currentSlice().html;
  if (!html) {
    setStatus("没有可下载的内容");
    return;
  }
  const name = `${fileBaseName()}.txt`;
  downloadFile(name, html, "text/plain;charset=utf-8");
  showTab("text");
  setStatus(`已下载 ${name}（内容为 HTML，可粘贴到公众号后台）`);
}

async function extract() {
  const url = els.url.value.trim();
  state.url = url;
  state.start = null;
  state.end = null;
  state.anchor = null;
  els.extractBtn.disabled = true;
  setStatus("正在打开文章并抽取 #js_content …");
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "抽取失败");
    state.html = data.html;
    state.text = data.text;
    state.blocks = data.blocks || [];
    renderBlocks();
    renderPreview();
    setStatus(`已抽到正文，${state.blocks.length} 个块。可在左侧点选范围。`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    els.extractBtn.disabled = false;
  }
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});
els.extractBtn.addEventListener("click", extract);
els.downloadHtmlBtn.addEventListener("click", downloadHtml);
els.downloadTxtBtn.addEventListener("click", downloadTxt);
els.fullBtn.addEventListener("click", showFullArticle);

els.formattedView.addEventListener("load", () => {
  const range = selectedRange();
  if (!range) return;
  const doc = els.formattedView.contentDocument;
  doc?.getElementById(`block-${range.lo}`)?.scrollIntoView({ block: "start" });
});
