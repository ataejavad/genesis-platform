import type { PGLiteSocketServer } from "@electric-sql/pglite-socket";

/*
 * Local mode only. pglite-socket queues single protocol messages from all connections onto one PGlite session and
 * only keeps a connection's messages together inside a transaction. A parameterized query outside a transaction is
 * several messages (Parse, Bind, Describe, Execute, Sync), so two processes could interleave and one Bind landed on
 * the other's unnamed statement ("bind message supplies 1 parameters, but prepared statement requires 3").
 * This keeps a connection's messages together until its Sync (or simple Query) as well.
 */

type Item = { handlerId: number; message: Uint8Array; resolve: (n: number) => void; reject: (e: unknown) => void; onData: (d: Uint8Array) => void };
type Queue = {
  queue: Item[];
  processing: boolean;
  lastHandlerId: number | null;
  db: { isInTransaction(): boolean; runExclusive<T>(fn: () => Promise<T>): Promise<T>; execProtocolRawStream(m: Uint8Array, o: { onRawData: (d: Uint8Array) => void }): Promise<unknown> };
  processQueue(): Promise<void>;
  clearQueueForHandler(id: number): void;
};

const SYNC = 0x53; // 'S'
const QUERY = 0x51; // 'Q'
const EXTENDED = new Set([0x50, 0x42, 0x44, 0x45, 0x43, 0x48]); // Parse, Bind, Describe, Execute, Close, Flush

export function keepExtendedQueriesTogether(server: PGLiteSocketServer) {
  const q = (server as unknown as { queryQueue: Queue }).queryQueue;
  let open: number | null = null; // connection in the middle of an extended query
  const clear = q.clearQueueForHandler.bind(q);
  q.clearQueueForHandler = (id: number) => {
    if (open === id) open = null;
    clear(id);
  };
  q.processQueue = async function (this: Queue) {
    if (this.processing || !this.queue.length) return;
    this.processing = true;
    while (this.queue.length) {
      const owner = open ?? (this.db.isInTransaction() ? this.lastHandlerId : null);
      const at = owner === null ? 0 : this.queue.findIndex((x) => x.handlerId === owner);
      if (at === -1) break; // wait for the owner's next message
      const [item] = this.queue.splice(at, 1);
      const type = item.message[0];
      try {
        await this.db.runExclusive(() => this.db.execProtocolRawStream(item.message, { onRawData: (d) => item.onData(d) }));
      } catch (err) {
        item.reject(err);
        continue;
      }
      if (EXTENDED.has(type)) open = item.handlerId;
      else if (type === SYNC || type === QUERY) open = null;
      this.lastHandlerId = item.handlerId;
      item.resolve(item.message.length);
    }
    this.processing = false;
  };
}
