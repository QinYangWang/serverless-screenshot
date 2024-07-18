import chromium from "@sparticuz/chromium";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const cfCheck = async (page) => {
  await page.waitForFunction("window._cf_chl_opt===undefined");
  const frames = await page.frames();

  for (const frame of frames) {
    const frameUrl = frame.url();
    try {
      const domain = new URL(frameUrl).hostname;
      console.log(domain);
      if (domain === "challenges.cloudflare.com") {
        const id = await frame.evaluate(
          () => window._cf_chl_opt.chlApiWidgetId
        );
        await page.waitForFunction(
          `document.getElementById("cf-chl-widget-${id}_response").value!==''`
        );
        console.log(
          await page.evaluate(
            () => document.getElementById(`cf-chl-widget-${id}_response`).value
          )
        );

        console.log("CF is loaded.");
      }
    } catch (error) {}
  }
}

export const lambdaHandler = async (event, context) => {
  let browser = null;
  let screenshotBase64 = null;
  const userAgent =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
  await chromium.font("/opt/fonts/LXGWWenKai.ttf");
  const url = event.queryStringParameters.url;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--disable-blink-features=AutomationControlled"],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const pages = await browser.pages();
    const page = pages[0];
    
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1920, height: 1080 });
    const preloadFile = fs.readFileSync(
      path.join(process.cwd(), "./preload.js"),
      "utf8"
    );
    await page.evaluateOnNewDocument(preloadFile);
    await page.goto(url, { waitUntil: "networkidle2" });
    await cfCheck(page);
  
    console.log("page title", await page.title());

    const blob = await page.screenshot({ type: "png"});
    screenshotBase64 = Buffer.from(blob).toString("base64");
    return {
    'headers': { "Content-Type": "image/png" },
    'statusCode': 200,
    'body': screenshotBase64,
    'isBase64Encoded': true
    }
  } catch (error) {
    console.error(error);
    return {
      'statusCode': 500,
      'body': JSON.stringify('Internal Server Error'),
      }
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};
