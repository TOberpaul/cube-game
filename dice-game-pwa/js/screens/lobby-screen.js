// Lobby Screen — Spielerstellung, Spielerliste und Spiel-Start
// Feature: dice-game-pwa, Anforderungen: 7.1, 8.2

import { t } from '../i18n.js';
import { navigate, getParams } from '../app.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';

/**
 * Factory for the Lobby Screen.
 * Shows player list, connection status, invite link (online) or peer discovery (offline),
 * and a start game button for the host.
 * @returns {{ mount(container: HTMLElement): void, unmount(): void }}
 */
export function createLobbyScreen() {
  let container = null;
  let cleanupHandlers = [];
  let players = [];
  let modeId = 'free-roll';
  let playType = 'online';
  let maxPlayers = 8;

  return {
    mount(el) {
      container = el;

      const params = getParams();
      modeId = params.modeId || 'free-roll';
      playType = params.playType || 'online';

      // Resolve maxPlayers from registry
      const registry = createGameModeRegistry();
      registerFreeRoll(registry);
      registerKniffel(registry);
      const mode = registry.get(modeId);
      if (mode) {
        maxPlayers = mode.maxPlayers;
      }

      // Initialize with host player
      players = [
        {
          id: 'host-1',
          name: t('scoreboard.player') + ' 1',
          connectionStatus: 'connected',
          isHost: true,
        },
      ];

      render();
    },

    unmount() {
      cleanupHandlers.forEach((fn) => fn());
      cleanupHandlers = [];
      if (container) {
        container.innerHTML = '';
        container = null;
      }
    },
  };

  /**
   * Renders the full lobby screen UI.
   */
  function render() {
    if (!container) return;
    container.innerHTML = '';

    const section = document.createElement('section');
    section.className = 'lobby-screen';
    section.setAttribute('aria-label', t('lobby.title'));

    // Title
    const heading = document.createElement('h1');
    heading.className = 'lobby-screen__title';
    heading.textContent = t('lobby.title');
    section.appendChild(heading);

    // Player count
    const countEl = document.createElement('p');
    countEl.className = 'lobby-screen__player-count';
    countEl.id = 'lobby-player-count';
    countEl.textContent = t('lobby.playerCount', { current: players.length, max: maxPlayers });
    section.appendChild(countEl);

    // Connection info (online: invite link, offline: peer discovery)
    section.appendChild(createConnectionInfo());

    // Player list
    section.appendChild(createPlayerList());

    // Actions (start game, leave)
    section.appendChild(createActions());

    container.appendChild(section);
  }

  /**
   * Creates the connection info section based on play type.
   * @returns {HTMLElement}
   */
  function createConnectionInfo() {
    const div = document.createElement('div');
    div.className = 'lobby-screen__connection-info';
    div.setAttribute('role', 'region');

    if (playType === 'online') {
      div.setAttribute('aria-label', t('lobby.inviteLink'));

      const label = document.createElement('p');
      label.className = 'lobby-screen__invite-label';
      label.textContent = t('lobby.inviteLink');
      div.appendChild(label);

      const linkRow = document.createElement('div');
      linkRow.className = 'lobby-screen__invite-row';

      const linkInput = document.createElement('input');
      linkInput.type = 'text';
      linkInput.readOnly = true;
      linkInput.className = 'lobby-screen__invite-input';
      linkInput.value = generateInviteLink();
      linkInput.setAttribute('aria-label', t('lobby.inviteLink'));
      linkRow.appendChild(linkInput);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'lobby-screen__copy-btn';
      copyBtn.textContent = t('lobby.copyLink');
      copyBtn.setAttribute('aria-label', t('lobby.copyLink'));

      const copyHandler = async () => {
        try {
          await navigator.clipboard.writeText(linkInput.value);
          copyBtn.textContent = t('lobby.linkCopied');
          setTimeout(() => {
            copyBtn.textContent = t('lobby.copyLink');
          }, 2000);
        } catch {
          // Fallback: select the input text
          linkInput.select();
        }
      };
      copyBtn.addEventListener('click', copyHandler);
      cleanupHandlers.push(() => copyBtn.removeEventListener('click', copyHandler));

      linkRow.appendChild(copyBtn);
      div.appendChild(linkRow);
    } else {
      // Offline: peer discovery message
      div.setAttribute('aria-label', t('lobby.peerDiscovery'));

      const peerMsg = document.createElement('p');
      peerMsg.className = 'lobby-screen__peer-discovery';
      peerMsg.setAttribute('role', 'status');
      peerMsg.setAttribute('aria-live', 'polite');
      peerMsg.textContent = t('lobby.peerDiscovery');
      div.appendChild(peerMsg);
    }

    return div;
  }

  /**
   * Creates the player list.
   * @returns {HTMLElement}
   */
  function createPlayerList() {
    const nav = document.createElement('div');
    nav.className = 'lobby-screen__players';
    nav.setAttribute('role', 'region');
    nav.setAttribute('aria-label', t('lobby.players'));

    const listHeading = document.createElement('h2');
    listHeading.className = 'lobby-screen__section-title';
    listHeading.textContent = t('lobby.players');
    nav.appendChild(listHeading);

    const ul = document.createElement('ul');
    ul.className = 'lobby-screen__player-list';
    ul.setAttribute('role', 'list');
    ul.id = 'lobby-player-list';

    players.forEach((player) => {
      ul.appendChild(createPlayerItem(player));
    });

    nav.appendChild(ul);
    return nav;
  }

  /**
   * Creates a single player list item.
   * @param {object} player
   * @returns {HTMLLIElement}
   */
  function createPlayerItem(player) {
    const li = document.createElement('li');
    li.className = 'lobby-screen__player-item';
    li.setAttribute('data-player-id', player.id);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'lobby-screen__player-name';
    nameSpan.textContent = player.name;
    li.appendChild(nameSpan);

    if (player.isHost) {
      const hostBadge = document.createElement('span');
      hostBadge.className = 'lobby-screen__host-badge';
      hostBadge.textContent = t('lobby.host');
      hostBadge.setAttribute('aria-label', t('lobby.host'));
      li.appendChild(hostBadge);
    }

    const statusSpan = document.createElement('span');
    statusSpan.className = 'lobby-screen__player-status';
    statusSpan.setAttribute('aria-label', t(`lobby.${player.connectionStatus}`));
    statusSpan.textContent = t(`lobby.${player.connectionStatus}`);
    statusSpan.dataset.status = player.connectionStatus;
    li.appendChild(statusSpan);

    return li;
  }

  /**
   * Creates the action buttons (start game, leave).
   * @returns {HTMLElement}
   */
  function createActions() {
    const div = document.createElement('div');
    div.className = 'lobby-screen__actions';

    // Start game button — only shown for host
    const isHost = players.some((p) => p.isHost && p.id === 'host-1');
    if (isHost) {
      const startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.className = 'lobby-screen__start-btn';
      startBtn.textContent = t('lobby.startGame');
      startBtn.setAttribute('aria-label', t('lobby.startGame'));
      startBtn.id = 'lobby-start-btn';

      const startHandler = () => {
        navigate('game', { modeId, playType });
      };
      startBtn.addEventListener('click', startHandler);
      cleanupHandlers.push(() => startBtn.removeEventListener('click', startHandler));

      div.appendChild(startBtn);
    }

    // Leave game button
    const leaveBtn = document.createElement('button');
    leaveBtn.type = 'button';
    leaveBtn.className = 'lobby-screen__leave-btn';
    leaveBtn.textContent = t('lobby.leaveGame');
    leaveBtn.setAttribute('aria-label', t('lobby.leaveGame'));

    const leaveHandler = () => {
      navigate('home');
    };
    leaveBtn.addEventListener('click', leaveHandler);
    cleanupHandlers.push(() => leaveBtn.removeEventListener('click', leaveHandler));

    div.appendChild(leaveBtn);
    return div;
  }

  /**
   * Generates a placeholder invite link for online multiplayer.
   * @returns {string}
   */
  function generateInviteLink() {
    const gameId = 'game-' + Math.random().toString(36).slice(2, 10);
    return `${window.location.origin}${window.location.pathname}#lobby?modeId=${modeId}&playType=online&gameId=${gameId}`;
  }
}
