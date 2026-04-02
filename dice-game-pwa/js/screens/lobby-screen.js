// Lobby Screen — Player list, connection info, and game start
// Feature: dice-game-pwa, Requirements: 7.1, 8.2

import { t } from '../i18n.js';
import { navigate, getParams } from '../app.js';
import { loadTemplate } from '../template-loader.js';
import { createGameModeRegistry } from '../game/game-mode-registry.js';
import { registerFreeRoll } from '../game/modes/free-roll.js';
import { registerKniffel } from '../game/modes/kniffel.js';

/**
 * Factory for the Lobby Screen.
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

      const registry = createGameModeRegistry();
      registerFreeRoll(registry);
      registerKniffel(registry);
      const mode = registry.get(modeId);
      if (mode) maxPlayers = mode.maxPlayers;

      players = [
        { id: 'host-1', name: t('scoreboard.player') + ' 1', connectionStatus: 'connected', isHost: true },
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

  async function render() {
    if (!container) return;

    const fragment = await loadTemplate('templates/lobby.html', t);

    // Player count
    const countEl = fragment.querySelector('#lobby-player-count');
    countEl.textContent = t('lobby.playerCount', { current: players.length, max: maxPlayers });

    // Connection info
    const connSlot = fragment.querySelector('[data-slot="connection-info"]');
    populateConnectionInfo(connSlot);

    // Player list
    const playerList = fragment.querySelector('[data-slot="player-list"]');
    players.forEach((player) => {
      playerList.appendChild(createPlayerItem(player));
    });

    // Actions
    const actionsSlot = fragment.querySelector('[data-slot="actions"]');
    populateActions(actionsSlot);

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  function populateConnectionInfo(slot) {
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
      linkInput.className = 'adaptive input__field';
      linkInput.setAttribute('data-material', 'filled-2');
      linkInput.setAttribute('data-interactive', '');
      linkInput.value = generateInviteLink();
      linkInput.setAttribute('aria-label', t('lobby.inviteLink'));
      linkRow.appendChild(linkInput);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'adaptive button';
      copyBtn.setAttribute('data-interactive', '');
      copyBtn.setAttribute('data-material', 'filled');
      copyBtn.textContent = t('lobby.copyLink');
      copyBtn.setAttribute('aria-label', t('lobby.copyLink'));

      const copyHandler = async () => {
        try {
          await navigator.clipboard.writeText(linkInput.value);
          copyBtn.textContent = t('lobby.linkCopied');
          setTimeout(() => { copyBtn.textContent = t('lobby.copyLink'); }, 2000);
        } catch {
          linkInput.select();
        }
      };
      copyBtn.addEventListener('click', copyHandler);
      cleanupHandlers.push(() => copyBtn.removeEventListener('click', copyHandler));

      linkRow.appendChild(copyBtn);
      div.appendChild(linkRow);
    } else {
      div.setAttribute('aria-label', t('lobby.peerDiscovery'));

      const peerMsg = document.createElement('p');
      peerMsg.className = 'lobby-screen__peer-discovery';
      peerMsg.setAttribute('role', 'status');
      peerMsg.setAttribute('aria-live', 'polite');
      peerMsg.textContent = t('lobby.peerDiscovery');
      div.appendChild(peerMsg);
    }

    slot.appendChild(div);
  }

  function createPlayerItem(player) {
    const li = document.createElement('li');
    li.className = 'adaptive lobby-screen__player';
    li.setAttribute('data-material', 'filled');
    li.setAttribute('data-player-id', player.id);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'lobby-screen__player-name';
    nameSpan.textContent = player.name;
    li.appendChild(nameSpan);

    if (player.isHost) {
      const hostBadge = document.createElement('span');
      hostBadge.className = 'adaptive badge';
      hostBadge.setAttribute('data-material', 'vibrant');
      hostBadge.setAttribute('data-color', 'blue');
      hostBadge.setAttribute('data-size', 'xs');
      hostBadge.textContent = t('lobby.host');
      hostBadge.setAttribute('aria-label', t('lobby.host'));
      li.appendChild(hostBadge);
    }

    const statusSpan = document.createElement('span');
    statusSpan.className = 'adaptive badge';
    statusSpan.setAttribute('data-size', 'xs');
    statusSpan.setAttribute('aria-label', t(`lobby.${player.connectionStatus}`));
    statusSpan.textContent = t(`lobby.${player.connectionStatus}`);
    statusSpan.dataset.status = player.connectionStatus;
    if (player.connectionStatus === 'connected') {
      statusSpan.setAttribute('data-material', 'vibrant');
      statusSpan.setAttribute('data-color', 'green');
    } else {
      statusSpan.setAttribute('data-material', 'vibrant');
      statusSpan.setAttribute('data-color', 'red');
    }
    li.appendChild(statusSpan);

    return li;
  }

  function populateActions(slot) {
    const isHost = players.some((p) => p.isHost && p.id === 'host-1');

    if (isHost) {
      const startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.className = 'adaptive button button--full-width';
      startBtn.setAttribute('data-interactive', '');
      startBtn.setAttribute('data-material', 'origin');
      startBtn.setAttribute('data-color', 'action');
      startBtn.setAttribute('data-container-contrast', 'max');
      startBtn.textContent = t('lobby.startGame');
      startBtn.setAttribute('aria-label', t('lobby.startGame'));
      startBtn.id = 'lobby-start-btn';

      const startHandler = () => navigate('game', { modeId, playType });
      startBtn.addEventListener('click', startHandler);
      cleanupHandlers.push(() => startBtn.removeEventListener('click', startHandler));
      slot.appendChild(startBtn);
    }

    const leaveBtn = document.createElement('button');
    leaveBtn.type = 'button';
    leaveBtn.className = 'adaptive button button--full-width';
    leaveBtn.setAttribute('data-interactive', '');
    leaveBtn.setAttribute('data-material', 'transparent');
    leaveBtn.textContent = t('lobby.leaveGame');
    leaveBtn.setAttribute('aria-label', t('lobby.leaveGame'));

    const leaveHandler = () => navigate('home');
    leaveBtn.addEventListener('click', leaveHandler);
    cleanupHandlers.push(() => leaveBtn.removeEventListener('click', leaveHandler));
    slot.appendChild(leaveBtn);
  }

  function generateInviteLink() {
    const gameId = 'game-' + Math.random().toString(36).slice(2, 10);
    return `${window.location.origin}${window.location.pathname}#lobby?modeId=${modeId}&playType=online&gameId=${gameId}`;
  }
}
