describe('PDF retry logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
    jest.restoreAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  function setupMocks(failuresBeforeSuccess: number, newPageHangs = 0) {
    let setContentCalls = 0;
    let newPageCalls = 0;

    const setContentMock = jest.fn(async () => {
      setContentCalls += 1;
      if (setContentCalls <= failuresBeforeSuccess) {
        throw new Error('Navigating frame was detached');
      }
    });

    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      setContent: setContentMock,
      emulateMediaType: jest.fn(async () => undefined),
      evaluate: jest.fn(async () => []),
      pdf: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
    };

    const context = {
      newPage: jest.fn(() => {
        newPageCalls += 1;
        if (newPageCalls <= newPageHangs) {
          // Simulates a page creation that never gets a response from the browser
          return new Promise<typeof page>(() => undefined);
        }

        return Promise.resolve(page);
      }),
      close: jest.fn(async () => undefined),
    };

    const browser = {
      createBrowserContext: jest.fn(async () => context),
      disconnect: jest.fn(),
    };

    const launchMock = jest.fn(async () => browser);

    jest.doMock('puppeteer', () => ({
      __esModule: true,
      default: { connect: jest.fn(), launch: launchMock },
    }));

    jest.doMock('@user-office-software/duo-logger', () => ({
      logger: {
        logInfo: jest.fn(),
        logWarn: jest.fn(),
        logDebug: jest.fn(),
        logError: jest.fn(),
        logException: jest.fn(),
      },
    }));

    jest.doMock('muhammara', () => ({
      __esModule: true,
      default: { createReader: jest.fn(), createWriter: jest.fn() },
    }));

    return { launchMock, setContentMock, page, context };
  }

  test('retries and succeeds on a later attempt', async () => {
    process.env = {
      ...originalEnv,
      BROWSER_WS_ENDPOINT: '',
      PDF_MAX_RETRIES: '2',
      PDF_GENERATION_TIMEOUT: '1000',
    };

    const { launchMock, setContentMock } = setupMocks(1);

    const { generatePdfFromHtml } = await import('../../pdf');

    const resultPromise = generatePdfFromHtml(
      '<html><body>retry</body></html>'
    );

    // Flush all backoff timers so retries proceed instantly
    await jest.runAllTimersAsync();

    const result = await resultPromise;

    expect(result.pdfPath).toContain('.pdf');
    expect(result.toc).toEqual([]);
    expect(launchMock).toHaveBeenCalledTimes(1);

    // Should have retried once, so setContent called twice
    expect(setContentMock).toHaveBeenCalledTimes(2);
  });

  test('fails after max retries are exhausted', async () => {
    process.env = {
      ...originalEnv,
      BROWSER_WS_ENDPOINT: '',
      PDF_MAX_RETRIES: '3',
      PDF_GENERATION_TIMEOUT: '1000',
    };

    const { setContentMock } = setupMocks(99);

    const { generatePdfFromHtml } = await import('../../pdf');

    // Attach rejection matcher BEFORE advancing timers to avoid unhandled rejection
    const resultPromise = generatePdfFromHtml(
      '<html><body>retry-fail</body></html>'
    );

    // eslint-disable-next-line jest/valid-expect
    const rejectionAssertion = expect(resultPromise).rejects.toThrow(
      '[generatePdfFromHtml] Failed to generate pdf from Html Navigating frame was detached'
    );

    // Flush all backoff timers so retries proceed instantly
    await jest.runAllTimersAsync();

    await rejectionAssertion;

    expect(setContentMock).toHaveBeenCalledTimes(3);
  });

  test('retries when page creation hangs', async () => {
    process.env = {
      ...originalEnv,
      BROWSER_WS_ENDPOINT: '',
      PDF_MAX_RETRIES: '2',
      PDF_GENERATION_TIMEOUT: '60000',
      PDF_PAGE_CREATION_TIMEOUT: '500',
    };

    const { launchMock, setContentMock, context } = setupMocks(0, 1);

    const { generatePdfFromHtml } = await import('../../pdf');

    const resultPromise = generatePdfFromHtml('<html><body>hang</body></html>');

    // Flush the page creation timeout and the backoff timers
    await jest.runAllTimersAsync();

    const result = await resultPromise;

    expect(result.pdfPath).toContain('.pdf');
    expect(launchMock).toHaveBeenCalledTimes(1);
    // The hung attempt is abandoned and its context closed, the retry succeeds
    expect(context.newPage).toHaveBeenCalledTimes(2);
    expect(context.close).toHaveBeenCalledTimes(2);
    expect(setContentMock).toHaveBeenCalledTimes(1);
  });

  test('fails when page creation hangs on every attempt', async () => {
    process.env = {
      ...originalEnv,
      BROWSER_WS_ENDPOINT: '',
      PDF_MAX_RETRIES: '2',
      PDF_PAGE_CREATION_TIMEOUT: '500',
    };

    const { context } = setupMocks(0, 99);

    const { generatePdfFromHtml } = await import('../../pdf');

    const resultPromise = generatePdfFromHtml(
      '<html><body>hang-fail</body></html>'
    );

    // eslint-disable-next-line jest/valid-expect
    const rejectionAssertion = expect(resultPromise).rejects.toThrow(
      '[generatePdfFromHtml] Failed to generate pdf from Html Browser page creation timed out after 500ms'
    );

    await jest.runAllTimersAsync();

    await rejectionAssertion;

    expect(context.newPage).toHaveBeenCalledTimes(2);
  });

  test('warmUpBrowser launches the local browser once and it is reused', async () => {
    process.env = {
      ...originalEnv,
      BROWSER_WS_ENDPOINT: '',
    };

    const { launchMock } = setupMocks(0);

    const { generatePdfFromHtml, warmUpBrowser } = await import('../../pdf');

    warmUpBrowser();

    expect(launchMock).toHaveBeenCalledTimes(1);

    const resultPromise = generatePdfFromHtml('<html><body>warm</body></html>');

    await jest.runAllTimersAsync();
    await resultPromise;

    expect(launchMock).toHaveBeenCalledTimes(1);
  });
});
