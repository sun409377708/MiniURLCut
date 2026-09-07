chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

let lastArticleTabId = null;

function normalizeArticleUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) throw new Error("请先输入公众号文章链接");
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("链接格式不正确");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("请使用 http 或 https 链接");
  }
  if (parsed.hostname !== "mp.weixin.qq.com") {
    throw new Error("目前只支持 mp.weixin.qq.com 文章链接");
  }
  parsed.protocol = "https:";
  return parsed.href;
}

function sameArticle(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname === ub.pathname && ua.search === ub.search;
  } catch {
    return false;
  }
}

function waitForTabComplete(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("页面加载超时"));
    }, timeoutMs);

    function onUpdated(id, info, tab) {
      if (id !== tabId || info.status !== "complete") return;
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url === "about:blank") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(tab);
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function openArticleTab(url) {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active?.id && sameArticle(active.url || "", url)) {
    lastArticleTabId = active.id;
    return active;
  }

  if (active?.id && active.url?.startsWith("https://mp.weixin.qq.com/")) {
    const pending = waitForTabComplete(active.id);
    await chrome.tabs.update(active.id, { url, active: true });
    const tab = await pending;
    lastArticleTabId = tab.id;
    return tab;
  }

  const created = await chrome.tabs.create({ url: "about:blank", active: true });
  const pending = waitForTabComplete(created.id);
  await chrome.tabs.update(created.id, { url });
  const tab = await pending;
  lastArticleTabId = tab.id;
  return tab;
}

async function waitForBody(tabId) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const [injected] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => Boolean(document.querySelector("#js_content, .rich_media_content")),
      });
      if (injected?.result) return;
    } catch {
      // tab may still be navigating
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("页面已打开，但未找到正文节点，请确认这是公众号文章");
}

async function ensureCore(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["extract-core.js"],
  });
}

async function extractFromTab(tabId) {
  await waitForBody(tabId);
  await ensureCore(tabId);
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const data = globalThis.MiniURLCut.extractFromDocument(document);
      if (data.ok) globalThis.MiniURLCut.markLiveBlocks(document);
      return { ...data, url: location.href };
    },
  });
  return injected?.result || { ok: false, error: "抽取失败" };
}

async function resolveHighlightTab() {
  if (lastArticleTabId) {
    try {
      const tab = await chrome.tabs.get(lastArticleTabId);
      if (tab?.id) return tab;
    } catch {
      lastArticleTabId = null;
    }
  }
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active?.url?.startsWith("https://mp.weixin.qq.com/")) return active;
  throw new Error("没有可高亮的文章页，请先解析链接");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "EXTRACT") {
    (async () => {
      const url = normalizeArticleUrl(message.url);
      const tab = await openArticleTab(url);
      return extractFromTab(tab.id);
    })()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "CURRENT_TAB_URL") {
    chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then(([tab]) => sendResponse({ ok: true, url: tab?.url || "" }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HIGHLIGHT") {
    (async () => {
      const tab = await resolveHighlightTab();
      await ensureCore(tab.id);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (lo, hi) => {
          globalThis.MiniURLCut.highlightRange(document, lo, hi);
        },
        args: [message.lo, message.hi],
      });
      return { ok: true };
    })()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
