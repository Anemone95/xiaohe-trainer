import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Xiaohe practice page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>小鹤双拼练习<\/title>/);
  assert.match(html, /请按对应的小鹤双拼键/);
  assert.match(html, /近期错题/);
  assert.match(html, /计时模式/);
  assert.doesNotMatch(html, /倒计时|剩余时间/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("contains the complete Xiaohe mappings and review schedule", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  for (const mapping of ['zh", key: "v', 'ch", key: "i', 'sh", key: "u', 's: ["ong", "iong"]', 'n: ["iao"]']) {
    assert.match(page, new RegExp(mapping.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(page, /60_000/);
  assert.match(page, /30 \* 24 \* 60 \* 60_000/);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /FIRST_ANSWER_TIMEOUT_MS = 5_000/);
  assert.match(page, /SECOND_ANSWER_TIMEOUT_MS = 8_000/);
  assert.match(page, /event\.code === "Space"/);
  assert.match(page, /timedMode && feedback !== "revealed"/);
  assert.match(page, /if \(paused\) return/);
  assert.match(page, /计时已暂停/);
  assert.match(page, /registerMiss\("slow"\)/);
  assert.match(page, /strongestSource === "direct" \? 3 : 5/);
  assert.match(page, /setMistakes\(\(current\) => \[log, \.\.\.current\.filter/);
  assert.match(page, /mistakes\.map\(\(item\) =>/);
  assert.doesNotMatch(page, /mistakes\.slice/);
  assert.doesNotMatch(page, /setMistakes[^\n]+\.slice/);
});
