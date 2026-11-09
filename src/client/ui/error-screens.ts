/**
 * Error screens: bad code, room full, server unreachable.
 */
export type ScreenError = 'bad_code' | 'room_full' | 'unreachable';

export interface ErrorScreenHandlers {
  onNewRoom: () => void;
  onBack: () => void;
  onSolo: () => void;
}

interface ErrorCopy {
  title: string;
  body: string;
  actions: { label: string; handler: keyof ErrorScreenHandlers }[];
}

export const ERROR_COPY: Record<ScreenError, ErrorCopy> = {
  bad_code: {
    title: 'No such room',
    body: 'That code does not lead anywhere. Check it, or start a new room.',
    actions: [
      { label: 'New room', handler: 'onNewRoom' },
      { label: 'Back', handler: 'onBack' },
    ],
  },
  room_full: {
    title: 'The house is full',
    body: 'All four seats in this room are taken.',
    actions: [
      { label: 'New room', handler: 'onNewRoom' },
      { label: 'Back', handler: 'onBack' },
    ],
  },
  unreachable: {
    title: 'The theatre is dark',
    body: 'The server could not be reached.',
    actions: [
      { label: 'Play solo', handler: 'onSolo' },
      { label: 'Back', handler: 'onBack' },
    ],
  },
};

export interface ErrorScreen {
  destroy(): void;
}

export function createErrorScreen(
  parent: HTMLElement,
  error: ScreenError,
  handlers: ErrorScreenHandlers,
): ErrorScreen {
  const copy = ERROR_COPY[error];
  const root = document.createElement('section');
  root.className = 'screen error-screen';
  root.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.className = 'screen-title';
  title.textContent = copy.title;
  const body = document.createElement('p');
  body.className = 'screen-sub';
  body.textContent = copy.body;
  root.append(title, body);
  let first: HTMLButtonElement | null = null;
  for (const action of copy.actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ui-button';
    b.textContent = action.label;
    b.addEventListener('click', handlers[action.handler]);
    root.appendChild(b);
    first ??= b;
  }
  parent.appendChild(root);
  first?.focus();
  return {
    destroy() {
      root.remove();
    },
  };
}
