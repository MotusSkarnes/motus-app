/** Run async tasks one at a time, in the order they were enqueued. */
export function createSerializedAsyncQueue() {
  let chain: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(task: () => Promise<T> | T): Promise<T> {
      const run = chain.then(task, task);
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}
