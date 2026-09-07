# MiniURLCut

本地抽取微信公众号正文（`#js_content`），支持范围选择、预览，以及下载 HTML / TXT（TXT 内仍是 HTML，方便粘贴到公众号后台）。

## 运行

```bash
npm install
npx playwright install chromium
npm start
```

浏览器打开 http://127.0.0.1:3780 ，粘贴 `mp.weixin.qq.com` 文章链接后点「一键抓正文」。

- 左侧单击选一块，Shift + 单击连选范围
- **下载 HTML**：居中排版的完整网页
- **下载 TXT**：同样的 HTML 内容，后缀为 `.txt`
