import { GetApi, Workflow, WorkflowContext, Communicator, CommunicatorContext, DBOSInitializer, InitContext } from '@dbos-inc/dbos-sdk';
import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = true;

let browser: Browser; // Reuse browser instance across invocations

export class HomepageWorkflow {
  @DBOSInitializer()
  static async init(ctxt: InitContext) {
    const executablePath = process.env.IS_LOCAL ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : await chromium.executablePath();
    ctxt.logger.info(`Chromium executable path is: ${executablePath}`);
    ctxt.logger.info('Launching browser...' + chromium.args.toString());
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: true,
      dumpio: true,
      ignoreHTTPSErrors: true,
    });
    ctxt.logger.info('Browser launched...');
  }

  @Communicator({retriesAllowed: false})
  static async screenshotCommunicator(ctxt: CommunicatorContext, domain:string) {
    ctxt.logger.info("Taking Screenshot");
    const page = await browser.newPage();
    ctxt.logger.info('setting viewport...');
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });

    // Go to the https site
    const url = `https://${domain}`;
    ctxt.logger.info(`goto page... ${url}`);
    await page.goto(url);
    const pageTitle = await page.title();
    ctxt.logger.info(`Page title: ${pageTitle}`);

    // Define the maximum height for the screenshot
    // TODO: due to DBOS Cloud 512MB memory limit, we need to limit the height of the screenshot
    const maxHeight = 1000;

    // Get the dimensions of the full page
    ctxt.logger.info('page evaluate...');
    const dimensions = await page.evaluate(() => {
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      };
    });

    const clipHeight = Math.min(dimensions.height, maxHeight);

    ctxt.logger.info(`page screenshot... width: ${dimensions.width}, height: ${clipHeight}`);
    const base64String = await page.screenshot({
      encoding: 'base64',
      clip: { x: 0, y: 0, width: dimensions.width, height: clipHeight},
      omitBackground: true,
    });

    await page.close();
    // ctxt.logger.info(`Image: ${base64String}`);
    return `screenshot base64 length: ${base64String.length}`;
  }

  @Workflow()
  @GetApi('/screenshot/:domain')
  static async LogArticle(ctxt: WorkflowContext, domain:string) {
    const result = await ctxt.invoke(HomepageWorkflow).screenshotCommunicator(domain);
    return result;
  }
}