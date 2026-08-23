import { useSyncExternalStore } from 'react';
import { dataStore, subscribe } from '../services/store';

let cache = snapshot();
function snapshot() {
  return {
    users: dataStore.getUsers(),
    customers: dataStore.getCustomers(),
    stores: dataStore.getStores(),
    pipelines: dataStore.getPipelines(),
    products: dataStore.getProducts(),
    settings: dataStore.getSettings(),
    loaded: dataStore.isLoaded(),
  };
}
function subscribeAndRefresh(cb: () => void) {
  return subscribe(() => {
    cache = snapshot();
    cb();
  });
}

/** Live snapshot of the DB; re-renders on any change. */
export function useData() {
  return useSyncExternalStore(subscribeAndRefresh, () => cache);
}
