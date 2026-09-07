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
  urlInput: document.getElementById("urlInput"),
  extractBtn: document.getElementById("extractBtn"),
  useCurrentBtn: document.getElementById("useCurrentBtn"),
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

function selectedRange() {
  if (state.start == null || state.end == null) return null;
  return {
    lo: Math.min(state.start, state.end),
    hi: Math.max(state.start, state.end),
  };
}

function currentSlice() {
  if (!state.blocks.length) return { html: "", text: "" };
  const range = selectedRange();
  if (!range) return { html: state.html, text: state.text };
  const sliced = state.blocks.slice(range.lo, range.hi + 1);
  return {
    html: sliced.map((block) => block.html).join(""),
    text: sliced.map((block) => block.text).filter(Boolean).join("\n\n"),
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

function wrapPreviewDocument() {
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
        <div class="card-body">${block.html}</div>
      </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <style>
    html, body { margin: 0; background: #d8d2c6; max-width: 100%; overflow-x: hidden; }
    body { padding: 10px; font-family: "PingFang SC", sans-serif; color: #3e3e3e; }
    .card {
      position: relative; background: #fff; border: 1px solid #b9b1a4;
      border-radius: 10px; margin: 0 0 12px; width: 100%; min-width: 0;
      box-sizing: border-box; overflow: hidden;
    }
    .card.is-selected { border: 2px solid #c48a12; box-shadow: 0 0 0 3px rgba(196,138,18,.28); }
    .card.is-dimmed { opacity: .36; }
    .card-tag {
      position: absolute; top: 8px; left: 8px; z-index: 2;
      background: #3a342c; color: #fff; font-size: 11px; padding: 5px 7px; border-radius: 999px;
    }
    .card.is-selected .card-tag { background: #c48a12; }
    .card-body { padding: 32px 12px 12px; text-align: center; overflow-wrap: anywhere; }
    .card-body, .card-body * { max-width: 100% !important; min-width: 0 !important; white-space: normal !important; box-sizing: border-box !important; }
    .card-body section, .card-body p, .card-body span {
      display: block !important; width: auto !important; height: auto !important;
      line-height: 1.7 !important; overflow: visible !important;
    }
    .card-body img, .card-body video {
      max-width: 100% !important; height: auto !important;
      display: inline-block !important; margin: 0 auto; vertical-align: middle;
    }
  </style>
</head>
<body>${cards}</body>
</html>`;
}

function syncHighlight() {
  const range = selectedRange();
  chrome.runtime.sendMessage({
    type: "HIGHLIGHT",
    lo: range ? range.lo : null,
    hi: range ? range.hi : null,
  });
}

function firstImageSrc(html) {
  const match =
    String(html || "").match(/\s(?:data-src|src)=["']([^"']+)["']/i);
  if (!match) return "";
  return match[1].replace(/&amp;/g, "&").split("#")[0];
}

function blockCaption(block) {
  const text = (block.text || "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 6);
  if (/<img/i.test(block.html)) return "图片";
  return "空";
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

    const src = firstImageSrc(block.html);
    const caption = blockCaption(block);
    if (src) {
      const img = document.createElement("img");
      img.className = "block-thumb";
      img.alt = "";
      img.src = src;
      li.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "block-placeholder";
      ph.textContent = caption;
      li.appendChild(ph);
    }

    const meta = document.createElement("div");
    meta.className = "block-meta";
    meta.innerHTML = `<span class="block-index">#${index + 1}</span><span class="block-label"></span>`;
    meta.querySelector(".block-label").textContent = caption;
    li.appendChild(meta);
    li.addEventListener("click", (event) => selectBlock(index, event));
    els.blockList.appendChild(li);
  });

  if (lo == null) {
    els.rangeMeta.textContent = `共 ${state.blocks.length} 块，当前为全文`;
  } else if (lo === hi) {
    els.rangeMeta.textContent = `已选第 ${lo + 1} 块`;
  } else {
    els.rangeMeta.textContent = `已选第 ${lo + 1}–${hi + 1} 块 · Shift 连选`;
  }
  els.fullBtn.disabled = !state.blocks.length;
}

function renderPreview() {
  const slice = currentSlice();
  els.formattedView.srcdoc = wrapPreviewDocument();
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
  syncHighlight();
}

function showFullArticle() {
  state.anchor = null;
  state.start = null;
  state.end = null;
  renderBlocks();
  renderPreview();
  syncHighlight();
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
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function downloadHtml() {
  const slice = currentSlice();
  if (!slice.html) return;
  const name = `${fileBaseName()}.html`;
  downloadFile(name, wrapDownloadDocument(slice.html), "text/html;charset=utf-8");
  setStatus(`已下载 ${name}`);
}

function downloadTxt() {
  const html = currentSlice().html;
  if (!html) return;
  const name = `${fileBaseName()}.txt`;
  downloadFile(name, html, "text/plain;charset=utf-8");
  showTab("text");
  setStatus(`已下载 ${name}（内容为 HTML，可粘贴到公众号后台）`);
}

async function extract() {
  const url = els.urlInput.value.trim();
  state.start = null;
  state.end = null;
  state.anchor = null;
  els.extractBtn.disabled = true;
  setStatus("正在打开链接并抽取正文 …");
  try {
    const data = await chrome.runtime.sendMessage({ type: "EXTRACT", url });
    if (!data?.ok) throw new Error(data?.error || "抽取失败");
    state.url = data.url || url;
    els.urlInput.value = state.url;
    state.html = data.html;
    state.text = data.text;
    state.blocks = data.blocks || [];
    renderBlocks();
    renderPreview();
    syncHighlight();
    setStatus(`已抽到正文，${state.blocks.length} 个块。`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    els.extractBtn.disabled = false;
  }
}

async function fillCurrentPage() {
  const data = await chrome.runtime.sendMessage({ type: "CURRENT_TAB_URL" });
  if (!data?.ok || !data.url) {
    setStatus("没有可用的当前页链接");
    return;
  }
  els.urlInput.value = data.url;
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});
els.extractBtn.addEventListener("click", extract);
els.useCurrentBtn.addEventListener("click", fillCurrentPage);
els.downloadHtmlBtn.addEventListener("click", downloadHtml);
els.downloadTxtBtn.addEventListener("click", downloadTxt);
els.fullBtn.addEventListener("click", showFullArticle);
els.urlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") extract();
});

els.formattedView.addEventListener("load", () => {
  const range = selectedRange();
  if (!range) return;
  els.formattedView.contentDocument
    ?.getElementById(`block-${range.lo}`)
    ?.scrollIntoView({ block: "start" });
});
