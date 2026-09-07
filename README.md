# MiniURLCut

抽取微信公众号正文（`#js_content`），圈选范围后下载 HTML / TXT（TXT 内仍是 HTML，方便粘贴到公众号后台）。

## Chrome 插件（推荐日常使用）

1. 打开 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 「加载已解压的扩展程序」，选择本仓库里的 `extension` 文件夹
4. 打开一篇 `mp.weixin.qq.com` 文章，点工具栏图标，侧栏里点「一键抓正文」

- 单击选一块，Shift + 单击连选；选中块会在原文上描金框
- **下载 HTML**：居中排版的完整网页
- **下载 TXT**：同样的 HTML 内容，后缀为 `.txt`

## 本地预览服务（开发调试）

```bash
npm install
npx playwright install chromium
npm start
```

浏览器打开 http://127.0.0.1:3780
