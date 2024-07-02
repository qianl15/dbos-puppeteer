import { GetApi, Workflow, WorkflowContext, Communicator, CommunicatorContext } from '@dbos-inc/dbos-sdk';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

export class HomepageWorkflow {
  @Communicator()
  static async screenshotCommunicator(ctxt: CommunicatorContext, domain:string) {
    ctxt.logger.info("Taking Screenshot");
    const executablePath = process.env.IS_LOCAL ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : await chromium.executablePath();
    ctxt.logger.info(`Chromium executable path is: ${executablePath}`);

    const url = 'https://' + domain;
    ctxt.logger.info('Launching browser...');
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle2' });
    const pageTitle = await page.title();
    ctxt.logger.info(`Page title: ${pageTitle}`);

    // Define the maximum height for the screenshot
    const maxHeight = 2000;

    // Get the dimensions of the full page
    const dimensions = await page.evaluate(() => {
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      };
    });

    const clipHeight = Math.min(dimensions.height, maxHeight);

    const base64String = await page.screenshot({
      encoding: 'base64',
      clip: { x: 0, y: 0, width: dimensions.width, height: clipHeight}
    });

    await browser.close();
    return `screenshot base64 length: ${base64String.length}`;
  }

  @Workflow()
  @GetApi('/screenshot/:domain')
  static async LogArticle(ctxt: WorkflowContext, domain:string) {
    const result = await ctxt.invoke(HomepageWorkflow).screenshotCommunicator(domain);
    return result;
  }
}