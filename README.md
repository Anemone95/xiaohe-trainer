# 小鹤双拼练习

一个使用 React 构建的本地小鹤双拼键位练习器。

## 功能

- 随机练习声母和韵母到键盘字母的映射
- 少量穿插 `s → s`、`a → a` 等原键题
- 第一次答错提示重试，第二次答错显示答案并记录错题
- 错题约 3 题后快速重现，再按 1 分钟至 30 天的间隔复习
- 练习进度、正确率和错题保存在浏览器本地
- 支持实体键盘和屏幕键盘
- 可选的隐藏计时模式；超时记为较轻的错误，不显示倒计时

## 运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000/`。

## 检查

```bash
npm test
```

## 发布到 Cloudflare Workers

在环境中配置 `CLOUDFLARE_ACCOUNT_ID` 和 `CLOUDFLARE_API_TOKEN` 后运行：

```bash
npm run deploy:worker
```

Worker 的自定义域名已通过 Cloudflare API 绑定到 `xiaohe.wenyuanxu.net`；后续运行该命令只更新 Worker，域名绑定会继续保留。
