/**
 * DOM overlay HUD. Reads display strings from hud-model and notices; draws nothing itself
 * beyond text nodes, so every colour comes from styles.css (the app entry imports it).
 */
import type { View } from '../../sim';
import { bindingsFor } from '../input/bindings';
import { hudModel, type HudRoster } from './hud-model';
import { activeNotices, addNotices, diffEvents, type EventSource, type Notice } from './notices';

export interface Hud {
  /** Show the playing HUD for this View. nowMs is any monotonic clock the caller owns. */
  update(view: View, roster: HudRoster, nowMs: number): void;
  /** Seconds of Reconnect_Grace left, or null when connected. */
  setReconnecting(graceSecondsLeft: number | null): void;
  destroy(): void;
}

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

function stat(parent: HTMLElement, label: string): { root: HTMLElement; value: HTMLElement } {
  const root = el('div', 'hud-stat', parent);
  el('span', 'hud-label', root).textContent = label;
  return { root, value: el('span', 'hud-value', root) };
}

export function createHud(parent: HTMLElement): Hud {
  const root = el('div', 'hud', parent);
  root.setAttribute('role', 'status');
  const top = el('div', 'hud-bar', root);
  const time = stat(top, 'Time');
  const ropes = stat(top, 'Ropes');
  const candles = stat(top, 'Candles');
  const fan = stat(top, 'Fan');
  const travel = stat(top, 'Cart');
  const scale = stat(top, 'Image');
  const who = el('div', 'hud-who', root);
  const roleText = el('span', 'hud-role', who);
  const codeText = el('span', 'hud-code', who);
  const keys = el('ul', 'hud-keys', root);
  keys.dataset.testid = 'hud-keys';
  root.dataset.testid = 'hud';
  roleText.dataset.testid = 'hud-role';
  const noticeBox = el('div', 'hud-notices', root);
  noticeBox.setAttribute('aria-live', 'polite');
  const reconnect = el('div', 'hud-reconnect', root);
  reconnect.hidden = true;

  let prev: EventSource | null = null;
  let notices: Notice[] = [];
  let shownRole: string | null = null;
  const snuffedIds = new Set<number>();

  function renderNotices(nowMs: number): void {
    notices = activeNotices(notices, nowMs);
    noticeBox.replaceChildren(
      ...notices.map((n) => {
        const item = el('div', 'hud-notice');
        item.textContent = n.text;
        return item;
      }),
    );
  }

  return {
    update(view, roster, nowMs) {
      for (const c of view.candles) if (c.status === 'snuffed') snuffedIds.add(c.id);
      const m = hudModel(view, roster, undefined, { snuffedCount: snuffedIds.size });
      time.value.textContent = m.time;
      ropes.value.textContent = m.ropes;
      candles.value.textContent = m.candles;
      fan.root.hidden = m.fan === null;
      fan.value.textContent = m.fan ?? '';
      fan.root.classList.toggle('is-ready', m.fan === 'Ready');
      travel.root.hidden = m.cartTravel === null;
      travel.value.textContent = m.cartTravel ?? '';
      scale.root.hidden = m.imageScale === null;
      scale.value.textContent = m.imageScale ?? '';
      roleText.textContent = m.role;
      codeText.textContent = m.roomCode;

      if (shownRole !== roster.role) {
        shownRole = roster.role;
        keys.replaceChildren(
          ...bindingsFor(roster.role).map((b) => {
            const li = el('li', 'hud-key');
            el('kbd', 'hud-kbd', li).textContent = b.label;
            el('span', 'hud-desc', li).textContent = b.description;
            return li;
          }),
        );
      }

      if (prev !== null) notices = addNotices(notices, diffEvents(prev, view), nowMs);
      prev = view;
      renderNotices(nowMs);
    },
    setReconnecting(graceSecondsLeft) {
      if (graceSecondsLeft === null) {
        reconnect.hidden = true;
        reconnect.textContent = '';
        return;
      }
      reconnect.hidden = false;
      reconnect.textContent = `Reconnecting... ${Math.max(0, Math.ceil(graceSecondsLeft))}s left to rejoin`;
    },
    destroy() {
      root.remove();
    },
  };
}
