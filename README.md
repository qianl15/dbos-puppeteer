# DBOS Puppeteer
Example DBOS app for using Puppeteer + Serverless Chromium to take screenshots of URLs.

The key idea is to use `puppeteer-core` and `@sparticuz/chromium`, and set an env variable in `dbos-config.yaml` to correctly load shared libraries on DBOS Cloud:
```
env:
  AWS_EXECUTION_ENV: 20.x
```
### Deploy to DBOS Cloud

It's fairly simple to deploy this app to DBOS Cloud:
```
# Download this repo.
git clone https://github.com/qianl15/dbos-puppeteer.git
cd dbos-puppeteer/
npm i
npm run build
npx dbos-cloud login
npx dbos-cloud app register -d <your_db_name> # Or provision a new DB
npx dbos-cloud app deploy
```

You should be able to take a screenshot now with your app! Try `https://<your username>-dbos-puppeteer.cloud.dbos.dev/screenshot/google.com`

### Under the Hood
In order to reuse the browser instance across requests, I create a browser instance as a `@DBOSInitializer()`.
On DBOS Cloud, it will use the Chrome binary provided by `@sparticuz/chromium`. To test locally, please set `LOCAL_CHROME_PATH` to your local Chrome executable. 
```js
@DBOSInitializer()
static async init(ctxt: InitContext) {
  const executablePath = process.env.LOCAL_CHROME_PATH ?? await chromium.executablePath();
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
```

Another note is that the latest version of `@sparticuz/chromium` has [some bugs](https://github.com/Sparticuz/chromium/issues/247) so we need to enable graphics mode:
```js
chromium.setGraphicsMode = true;
```

Then in a communicator, it opens a page, gets the title of the page, and then takes a screenshot of it. Note that DBOS Cloud has a 512MB memory limit, so the screenshot may fail due to OOM. Please try to reduce the resolution of your screenshots or limit the dimensions of them.
```js
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
  // Due to DBOS Cloud 512MB memory limit, we need to limit the height of the screenshot
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
```
