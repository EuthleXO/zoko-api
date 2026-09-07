import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Referer: "https://zokoanime.video/",
  Origin: "https://zokoanime.video",
};

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl || !targetUrl.includes("zokoanime.video")) {
    return NextResponse.json(
      {
        success: false,
        message: "Valid zokoanime.video url required",
        coder: "Telegram @flexyy",
      },
      { status: 400 }
    );
  }

  const cached = cache.get(targetUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
      coder: "Telegram @flexyy",
    });
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-background-networking",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(HEADERS["User-Agent"]);
    await page.setRequestInterception(true);

    const m3u8: string[] = [];
    const vtt: string[] = [];

    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "font", "stylesheet", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("hls2.aniwatchtv.uk") && url.includes(".m3u8")) {
        m3u8.push(url);
      }
      if (url.includes("hls2.aniwatchtv.uk") && url.endsWith(".vtt")) {
        vtt.push(url);
      }
    });

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 18000,
    });

    await page
      .waitForResponse(
        (r) =>
          r.url().includes("hls2.aniwatchtv.uk") &&
          r.url().includes("master.m3u8"),
        { timeout: 10000 }
      )
      .catch(() => {});

    await browser.close();
    browser = null;

    const master =
      m3u8.find((u) => u.includes("master.m3u8")) || m3u8[0] || null;

    const result = {
      success: true,
      m3u8: master,
      subtitles: [...new Set(vtt)],
      headers: HEADERS,
      cached: false,
    };

    if (master) {
      cache.set(targetUrl, { data: result, ts: Date.now() });
    }

    return NextResponse.json({
      ...result,
      coder: "Telegram @flexyy",
    });
  } catch (err: any) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Extraction failed",
        coder: "Telegram @flexyy",
      },
      { status: 500 }
    );
  }
}
