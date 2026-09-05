type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyAuthProfileChanged() {
  listeners.forEach((listener) => listener());
}

export function onAuthProfileChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
