/**
 * Start screen: create a room, join with a code, or play solo.
 * Palette-styled DOM; the code field is a styled text input (no native chrome, see styles.css).
 */
export interface StartScreenHandlers {
  onCreate: () => void;
  onJoin: (code: string) => void;
  onSolo: () => void;
}

export interface StartScreen {
  /** Show an inline message under the join field (e.g. "A room code is 4 letters or digits"). */
  setMessage(text: string): void;
  destroy(): void;
}

import { ROOM_CODE_PATTERN } from '../../net/protocol';

const CODE_LENGTH = 4;
// Same pattern the server uses: generated codes contain digits as well as letters.
const CODE_PATTERN = ROOM_CODE_PATTERN;

export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCodeShape(code: string): boolean {
  return CODE_PATTERN.test(code);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

export function createStartScreen(parent: HTMLElement, handlers: StartScreenHandlers): StartScreen {
  const root = el('section', 'screen start-screen', parent);
  root.setAttribute('aria-labelledby', 'start-title');
  const title = el('h1', 'screen-title', root, 'Lantern');
  title.id = 'start-title';
  el('p', 'screen-sub', root, 'One of you runs the show. Three of you keep the candles lit.');

  const create = el('button', 'ui-button', root, 'Create room');
  create.type = 'button';
  create.dataset.testid = 'start-create';
  create.addEventListener('click', handlers.onCreate);

  const form = el('form', 'start-join', root);
  const label = el('label', 'hud-label', form, 'Room code');
  const input = el('input', 'ui-input', form);
  input.type = 'text';
  input.maxLength = CODE_LENGTH;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.id = 'start-code';
  label.htmlFor = input.id;
  const join = el('button', 'ui-button', form, 'Join');
  join.type = 'submit';
  const message = el('p', 'screen-message', root);
  message.setAttribute('role', 'alert');

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const code = normaliseCode(input.value);
    if (!isValidCodeShape(code)) {
      message.textContent = `A room code is ${CODE_LENGTH} letters or digits.`;
      input.focus();
      return;
    }
    message.textContent = '';
    handlers.onJoin(code);
  });

  const solo = el('button', 'ui-button', root, 'Play solo');
  solo.type = 'button';
  solo.addEventListener('click', handlers.onSolo);

  create.focus();
  return {
    setMessage(text) {
      message.textContent = text;
    },
    destroy() {
      root.remove();
    },
  };
}
