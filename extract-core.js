(function (root) {
  const MiniURLCut = {};

  MiniURLCut.findBody = function (doc) {
    const d = doc || document;
    return d.querySelector("#js_content") || d.querySelector(".rich_media_content");
  };

  MiniURLCut.materializeImages = function (root) {
    root.querySelectorAll("img").forEach((img) => {
      const real =
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("src");
      if (real) img.setAttribute("src", real);
    });
  };

  MiniURLCut.htmlToText = function (root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script, style, noscript").forEach((n) => n.remove());
    clone.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
    clone.querySelectorAll("p, section, h1, h2, h3, h4, h5, h6, li, blockquote").forEach((n) => {
      n.append("\n\n");
    });
    clone.querySelectorAll("img, video, mp-common-videosnap").forEach((n) => n.remove());
    return clone.textContent
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  MiniURLCut.isBlockCandidate = function (el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName.toLowerCase();
    if (["script", "style", "noscript"].includes(tag)) return false;
    const text = (el.innerText || "").trim();
    const hasImg = !!el.querySelector("img");
    return text.length > 0 || hasImg;
  };

  MiniURLCut.getBlocks = function (root) {
    const selectors = "section, p, h1, h2, h3, h4, h5, h6, li, blockquote";
    const candidates = Array.from(root.querySelectorAll(selectors));
    const leaves = candidates.filter((el) => {
      if (!MiniURLCut.isBlockCandidate(el)) return false;
      const nested = Array.from(el.querySelectorAll(selectors)).some(
        MiniURLCut.isBlockCandidate
      );
      return !nested;
    });
    const nodes = leaves.length
      ? leaves
      : MiniURLCut.isBlockCandidate(root)
        ? [root]
        : [];
    return nodes.map((el, index) => ({
      index,
      tag: el.tagName.toLowerCase(),
      html: el.outerHTML,
      text: MiniURLCut.htmlToText(el),
    }));
  };

  MiniURLCut.sliceBlocks = function (blocks, start, end) {
    const a = Math.max(0, Math.min(start, end));
    const b = Math.min(blocks.length - 1, Math.max(start, end));
    const sliced = blocks.slice(a, b + 1);
    const html = sliced.map((block) => block.html).join("");
    const text = sliced
      .map((block) => block.text)
      .filter(Boolean)
      .join("\n\n");
    return { html, text, blocks: sliced, start: a, end: b };
  };

  MiniURLCut.extractFromDocument = function (doc) {
    const body = MiniURLCut.findBody(doc);
    if (!body) {
      return {
        ok: false,
        error: "未找到正文节点 #js_content / .rich_media_content",
      };
    }

    const clone = body.cloneNode(true);
    MiniURLCut.materializeImages(clone);
    clone.querySelectorAll("script, style").forEach((n) => n.remove());

    const blocks = MiniURLCut.getBlocks(clone);
    return {
      ok: true,
      html: clone.innerHTML,
      text: MiniURLCut.htmlToText(clone),
      blocks,
    };
  };

  root.MiniURLCut = MiniURLCut;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = MiniURLCut;
  }
})(typeof window !== "undefined" ? window : globalThis);
