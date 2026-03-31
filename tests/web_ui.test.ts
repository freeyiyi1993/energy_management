// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { createServer, type Server } from 'http';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distWebPath = path.resolve(__dirname, '../dist-web');

let browser: Browser;
let server: Server;
let baseUrl: string;

function startServer(): Promise<string> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      let filePath = path.join(distWebPath, req.url === '/' ? '/index.html' : req.url!);
      if (!existsSync(filePath)) {
        filePath = path.join(distWebPath, 'index.html');
      }
      const ext = path.extname(filePath);
      const mimeMap: Record<string, string> = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
      };
      const mime = mimeMap[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(readFileSync(filePath));
    });
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve(`http://localhost:${addr.port}`);
    });
  });
}

async function freshPage(): Promise<Page> {
  const p = await browser.newPage();
  await p.goto(baseUrl);
  await p.waitForSelector('#root > div', { timeout: 8000 });
  // 等待精力条渲染
  await p.waitForFunction(() => {
    return document.body.textContent?.includes('精力值');
  }, { timeout: 8000 });
  return p;
}

describe('Web UI', () => {
  beforeAll(async () => {
    baseUrl = await startServer();
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  });

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  it('should render the main page with energy bar', async () => {
    const page = await freshPage();
    const bodyText = await page.$eval('body', el => el.textContent);
    expect(bodyText).toContain('精力值');
    await page.close();
  });

  it('should start pomodoro on click', async () => {
    const page = await freshPage();
    // Play 图标可见（idle 状态）
    const playIcon = await page.waitForSelector('.lucide-play', { timeout: 3000 });
    expect(playIcon).not.toBeNull();

    // 点击包含 Play 的圆圈
    await page.evaluate(() => {
      const play = document.querySelector('.lucide-play');
      const circle = play?.closest('[class*="cursor-pointer"]');
      (circle as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Play 图标消失（正在运行）
    const playAfter = await page.$('.lucide-play');
    expect(playAfter).toBeNull();
    await page.close();
  });

  it('should stop pomodoro on second click', async () => {
    const page = await freshPage();

    // 开始
    await page.evaluate(() => {
      const play = document.querySelector('.lucide-play');
      const circle = play?.closest('[class*="cursor-pointer"]');
      (circle as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // 停止：点击同一个圆圈（现在没有 Play overlay）
    await page.evaluate(() => {
      const circles = document.querySelectorAll('[class*="cursor-pointer"]');
      for (const c of circles) {
        if (c.querySelector('[class*="conic-gradient"]') || (c as HTMLElement).style.background?.includes('conic')) {
          (c as HTMLElement).click();
          return;
        }
      }
      // fallback: click the first cursor-pointer with text containing ':'
      for (const c of circles) {
        if (c.textContent?.match(/\d{2}:\d{2}/)) {
          (c as HTMLElement).click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    const play = await page.$('.lucide-play');
    expect(play).not.toBeNull();
    await page.close();
  });

  it('should increment water count on click', async () => {
    const page = await freshPage();
    // 找到喝水按钮
    const waterBtn = await page.evaluateHandle(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('喝水') && btn.textContent?.includes('0/')) {
          return btn;
        }
      }
      return null;
    });
    expect(await waterBtn.evaluate(el => el !== null)).toBe(true);

    await (waterBtn as any).click();
    await new Promise(r => setTimeout(r, 1000));

    // 重新读取按钮文本
    const text = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('喝水')) return btn.textContent;
      }
      return '';
    });
    expect(text).toContain('1/');
    await page.close();
  });

  it('should navigate to stats page', async () => {
    const page = await freshPage();
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('数据统计')) {
          btn.click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    const body = await page.$eval('body', el => el.textContent);
    expect(body).toContain('返回');
    await page.close();
  });

  it('should navigate to rules page via menu', async () => {
    const page = await freshPage();
    // 打开菜单
    await page.evaluate(() => {
      const icon = document.querySelector('.lucide-menu');
      const div = icon?.closest('div');
      (div as HTMLElement)?.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // 点击规则
    await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="cursor-pointer"]');
      for (const item of items) {
        if (item.textContent?.includes('规则')) {
          (item as HTMLElement).click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const body = await page.$eval('body', el => el.textContent);
    expect(body).toContain('系统规则说明');
    await page.close();
  });
});
