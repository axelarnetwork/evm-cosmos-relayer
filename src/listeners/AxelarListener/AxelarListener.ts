import ReconnectingWebSocket from 'reconnecting-websocket';
import WebSocket from 'isomorphic-ws';
import { Subject } from 'rxjs';
import { DatabaseClient } from '../..';
import { AxelarListenerEvent } from './eventTypes';
import { logger } from '../../logger';

export class AxelarListener {
  private wsMap: Map<string, ReconnectingWebSocket>;
  private wsOptions = {
    WebSocket, // custom WebSocket constructor
    connectionTimeout: 30000,
    maxRetries: 10,
  };

  private wsUrl: string;
  private db: DatabaseClient;

  constructor(db: DatabaseClient, wsUrl: string) {
    this.db = db;
    this.wsMap = new Map();
    this.wsUrl = wsUrl;
  }

  private getWs(topicId: string) {
    const _ws = this.wsMap.get(topicId);
    if (_ws) {
      return _ws;
    }
    const ws = new ReconnectingWebSocket(this.wsUrl, [], this.wsOptions);
    this.wsMap.set(topicId, ws);

    return ws;
  }

  public listen<T>(event: AxelarListenerEvent<T>, subject: Subject<T>) {
    const ws = this.getWs(event.topicId);
    ws.reconnect();
    logger.info(
      `[AxelarListener] Listening to "${event.type}" event`
    );
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'subscribe',
        params: [event.topicId],
      })
    );
    ws.addEventListener('message', (ev: MessageEvent<any>) => {
      // convert buffer to json
      const _event = JSON.parse(ev.data.toString());

      // check if the event topic is matched
      if (!_event.result || _event.result.query !== event.topicId) return;

      logger.debug(`[AxelarListener] Received ${ev.type} event.`);

      // parse the event data
      try {
        event.parseEvent(_event.result.events).then((ev) => {
          subject.next(ev);
        });
      } catch (e) {
        logger.error(
          `[AxelarListener] Failed to parse topic ${event.topicId} GMP event: ${e}`
        );
      }
    });
  }
}
