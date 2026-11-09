/**
 * Lobby: Join_Link with a styled copy control, seat list, roles and a start control for the Showman.
 * Also exports a small reconnect banner used on screens that have no HUD.
 * Palette-styled DOM only; no browser-default dialogs.
 */
import type { Roster, SeatInfo } from '../session/session';

export interface LobbyHandlers {
  onStart: () => void;
  onLeave: () => void;
}

export interface LobbyIdentity {
  player: number;
  code: string;
}

export interface Lobby {
  update(roster: Roster, self: LobbyIdentity): void;
  /** Free text under the title, e.g. "The last round has ended." */
  setNote(text: string): void;
  destroy(): void;
}

export function joinLink(origin: string, code: string): string {
  return `${origin}/r/${code}`;
}

export function seatLabel(seat: SeatInfo, selfSeat: number): string {
  if (seat.kind === 'open') return 'Open';
  if (seat.kind === 'bot') return 'Bot';
  const base = seat.seat === selfSeat ? 'You' : 'Player';
  return seat.connected ? base : `${base} (reconnecting)`;
}

export function roleLabel(seat: SeatInfo, showman: number): string {
  return seat.seat === showman ? 'Showman' : 'Spectator';
}

/** Copy text. Uses the async clipboard when present, otherwise a hidden textarea. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'visually-hidden';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
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

export function createLobby(parent: HTMLElement, handlers: LobbyHandlers): Lobby {
  const root = el('section', 'screen lobby-screen', parent);
  root.setAttribute('aria-labelledby', 'lobby-title');
  const title = el('h1', 'screen-title', root, 'The green room');
  title.id = 'lobby-title';
  const note = el('p', 'screen-sub', root);

  const linkRow = el('div', 'lobby-link', root);
  const linkLabel = el('label', 'hud-label', linkRow, 'Join link');
  const linkInput = el('input', 'ui-input lobby-link-input', linkRow);
  linkInput.type = 'text';
  linkInput.readOnly = true;
  linkInput.id = 'lobby-link';
  linkLabel.htmlFor = linkInput.id;
  linkInput.addEventListener('focus', () => linkInput.select());
  const copy = el('button', 'ui-button', linkRow, 'Copy link');
  copy.type = 'button';
  const copyStatus = el('p', 'screen-message lobby-copy-status', root);
  copyStatus.setAttribute('role', 'status');
  copy.addEventListener('click', () => {
    void copyText(linkInput.value).then((ok) => {
      if (ok) copyStatus.textContent = 'Link copied.';
      else {
        copyStatus.textContent = 'Copy it by hand from the field.';
        linkInput.focus();
      }
    });
  });

  const seats = el('ul', 'lobby-seats', root);
  seats.setAttribute('aria-label', 'Seats');

  const start = el('button', 'ui-button lobby-start', root, 'Start the show');
  start.type = 'button';
  start.dataset.testid = 'lobby-start';
  start.addEventListener('click', handlers.onStart);
  const wait = el('p', 'screen-sub lobby-wait', root);

  const leave = el('button', 'ui-button', root, 'Leave');
  leave.type = 'button';
  leave.addEventListener('click', handlers.onLeave);

  let focused = false;
  return {
    setNote(text) {
      note.textContent = text;
    },
    update(roster, self) {
      linkInput.value = joinLink(location.origin, self.code);
      const rows = roster.seats.map((seat) => {
        const li = el('li', 'lobby-seat');
        if (seat.seat === self.player) li.classList.add('is-self');
        el('span', 'hud-kbd', li, `${seat.seat + 1}`);
        el('span', 'hud-desc', li, seatLabel(seat, self.player));
        el('span', 'hud-label', li, roleLabel(seat, roster.showman));
        return li;
      });
      seats.replaceChildren(...rows);
      const isShowman = roster.showman === self.player;
      start.hidden = !isShowman;
      wait.hidden = isShowman;
      wait.textContent = 'Waiting for the Showman to start.';
      if (!focused) {
        focused = true;
        (isShowman ? start : copy).focus();
      }
    },
    destroy() {
      root.remove();
    },
  };
}

export interface ReconnectBanner {
  /** Seconds of grace left, or null to hide. */
  set(graceSecondsLeft: number | null): void;
  destroy(): void;
}

export function createReconnectBanner(parent: HTMLElement): ReconnectBanner {
  const box = el('div', 'hud-reconnect reconnect-banner', parent);
  box.setAttribute('role', 'status');
  box.hidden = true;
  return {
    set(left) {
      box.hidden = left === null;
      if (left !== null) box.textContent = `Reconnecting... ${left}s left to rejoin your seat`;
    },
    destroy() {
      box.remove();
    },
  };
}
