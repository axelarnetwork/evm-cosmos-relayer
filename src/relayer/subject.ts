import { Subject } from 'rxjs';
import { EvmEvent, IBCEvent } from '../types';

export function createEvmEventSubject<T>(): Subject<EvmEvent<T>> {
  return new Subject<EvmEvent<T>>();
}

export function createCosmosEventSubject<T>(): Subject<IBCEvent<T>> {
  return new Subject<IBCEvent<T>>();
}
