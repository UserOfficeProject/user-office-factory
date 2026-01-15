import { setTimeout as delay } from 'timers/promises';

import { Semaphore } from '../../pdf/semaphore';

describe('Semaphore', () => {
  test('acquire resolves immediately when permits are available', async () => {
    const semaphore = new Semaphore(1);

    await semaphore.acquire();

    // If acquire did not resolve, we would never reach here.
    expect(true).toBe(true);
  });

  test('acquire blocks when no permits, then resolves after release', async () => {
    const semaphore = new Semaphore(1);

    await semaphore.acquire();

    let acquired = false;
    const pending = semaphore.acquire().then(() => {
      acquired = true;
    });

    await delay(0);
    expect(acquired).toBe(false);

    semaphore.release();
    await pending;
    expect(acquired).toBe(true);
  });

  test('permits=0 means acquire blocks until a release happens', async () => {
    const semaphore = new Semaphore(0);

    let acquired = false;
    const pending = semaphore.acquire().then(() => {
      acquired = true;
    });

    await delay(0);
    expect(acquired).toBe(false);

    semaphore.release();
    await pending;
    expect(acquired).toBe(true);
  });

  test('queued acquires are served in FIFO order', async () => {
    const semaphore = new Semaphore(1);
    const order: number[] = [];

    // Take the only permit so subsequent acquires queue.
    await semaphore.acquire();

    const p1 = semaphore.acquire().then(() => order.push(1));
    const p2 = semaphore.acquire().then(() => order.push(2));
    const p3 = semaphore.acquire().then(() => order.push(3));

    await delay(0);
    expect(order).toEqual([]);

    semaphore.release();
    await p1;

    semaphore.release();
    await p2;

    semaphore.release();
    await p3;

    expect(order).toEqual([1, 2, 3]);
  });

  test('limits concurrency to the number of permits', async () => {
    const semaphore = new Semaphore(2);

    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async () => {
      await semaphore.acquire();
      try {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await delay(30);
      } finally {
        concurrent -= 1;
        semaphore.release();
      }
    };

    await Promise.all(Array.from({ length: 8 }, () => task()));

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
