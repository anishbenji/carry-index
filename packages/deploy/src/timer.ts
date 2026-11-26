/** Starts a one-shot timer and returns its cancel function. Injected so tests never wait on a real clock. */
export type SetTimer = (callback: () => void, ms: number) => () => void;

export const realTimer: SetTimer = (callback, ms) => {
  const handle = setTimeout(callback, ms);
  return () => clearTimeout(handle);
};
