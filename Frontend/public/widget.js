/*!
 * CDC Business AI — embeddable chat widget.
 * <script src="https://cdc.org.ge/widget.js" data-agent-id="AGENT_UUID" defer></script>
 * Vanilla JS, no dependencies. Renders inside a Shadow DOM so the host
 * page's CSS can never leak in, and this widget's styles can never leak
 * out onto the host page.
 */
(function () {
  'use strict';

  var currentScript = document.currentScript;
  if (!currentScript) return;

  var agentId = currentScript.getAttribute('data-agent-id');
  if (!agentId) {
    console.error('[CDC Widget] Missing required data-agent-id attribute.');
    return;
  }

  // Defaults to the script's own origin (the CDC backend and this static
  // file are served from the same domain in production) — a data-api-base
  // override is only needed for local development against a different port.
  var apiBase = currentScript.getAttribute('data-api-base') || new URL(currentScript.src).origin + '/api';

  var VISITOR_KEY = 'cdc_widget_visitor_ref';
  var CONVO_KEY_PREFIX = 'cdc_widget_conversation_';

  function getVisitorRef() {
    try {
      var existing = localStorage.getItem(VISITOR_KEY);
      if (existing) return existing;
      var fresh = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      localStorage.setItem(VISITOR_KEY, fresh);
      return fresh;
    } catch (e) {
      // Storage unavailable (private browsing, etc.) — fall back to a
      // session-only ref so the widget still works, just without
      // continuity across page loads.
      return 'v_session_' + Math.random().toString(36).slice(2);
    }
  }

  function getStoredConversationId() {
    try {
      return localStorage.getItem(CONVO_KEY_PREFIX + agentId);
    } catch (e) {
      return null;
    }
  }

  function storeConversationId(id) {
    try {
      localStorage.setItem(CONVO_KEY_PREFIX + agentId, id);
    } catch (e) {}
  }

  var visitorRef = getVisitorRef();
  var conversationId = getStoredConversationId();

  // --- Host element + Shadow DOM ---
  var host = document.createElement('div');
  host.id = 'cdc-ai-widget-root';
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

  var style = document.createElement('style');
  style.textContent = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
    '.cdc-bubble { position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 2147483000; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }',
    '.cdc-bubble:hover { transform: scale(1.08); }',
    '.cdc-bubble svg { width: 26px; height: 26px; }',
    '.cdc-panel { position: fixed; bottom: 88px; right: 20px; width: 340px; max-width: calc(100vw - 40px); height: 480px; max-height: calc(100vh - 120px); background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.25); display: none; flex-direction: column; overflow: hidden; z-index: 2147483000; }',
    '.cdc-panel.open { display: flex; }',
    '.cdc-header { padding: 14px 16px; color: #fff; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: space-between; }',
    '.cdc-close { background: transparent; border: none; color: #fff; cursor: pointer; font-size: 18px; line-height: 1; opacity: 0.85; }',
    '.cdc-close:hover { opacity: 1; }',
    '.cdc-messages { flex: 1; overflow-y: auto; padding: 12px; background: #f8fafc; display: flex; flex-direction: column; gap: 8px; }',
    '.cdc-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }',
    '.cdc-msg.user { align-self: flex-end; background: #0ea5e9; color: #fff; border-bottom-right-radius: 2px; }',
    '.cdc-msg.assistant { align-self: flex-start; background: #e2e8f0; color: #0f172a; border-bottom-left-radius: 2px; }',
    '.cdc-input-row { display: flex; gap: 6px; padding: 10px; border-top: 1px solid #e2e8f0; background: #fff; }',
    '.cdc-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 20px; padding: 8px 14px; font-size: 13px; outline: none; }',
    '.cdc-send { border: none; border-radius: 50%; width: 34px; height: 34px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
    '.cdc-send:disabled { opacity: 0.5; cursor: default; }',
    '.cdc-footer { padding: 6px 12px; text-align: center; font-size: 10px; background: #fff; border-top: 1px solid #f1f5f9; }',
    '.cdc-footer a { color: #64748b; text-decoration: none; }',
    '.cdc-footer a:hover { text-decoration: underline; }',
  ].join('\n');
  shadow.appendChild(style);

  var bubble = document.createElement('button');
  bubble.className = 'cdc-bubble';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
  shadow.appendChild(bubble);

  var panel = document.createElement('div');
  panel.className = 'cdc-panel';
  panel.innerHTML =
    '<div class="cdc-header">' +
    '  <span class="cdc-agent-name">CDC Business AI</span>' +
    '  <button class="cdc-close" aria-label="Close chat">✕</button>' +
    '</div>' +
    '<div class="cdc-messages"></div>' +
    '<div class="cdc-input-row">' +
    '  <input class="cdc-input" type="text" placeholder="Type a message..." />' +
    '  <button class="cdc-send" aria-label="Send">' +
    '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
    '  </button>' +
    '</div>' +
    '<div class="cdc-footer"><a href="https://cdc.org.ge" target="_blank" rel="noopener">Powered by CDC AI</a></div>';
  shadow.appendChild(panel);

  var messagesEl = panel.querySelector('.cdc-messages');
  var inputEl = panel.querySelector('.cdc-input');
  var sendBtn = panel.querySelector('.cdc-send');
  var closeBtn = panel.querySelector('.cdc-close');
  var headerEl = panel.querySelector('.cdc-header');
  var nameEl = panel.querySelector('.cdc-agent-name');

  var primaryColor = '#06b6d4';
  var isOpen = false;
  var sending = false;

  function applyColor(color) {
    primaryColor = color;
    bubble.style.background = color;
    headerEl.style.background = color;
    sendBtn.style.background = color;
  }
  applyColor(primaryColor);

  function appendMessage(role, content) {
    var el = document.createElement('div');
    el.className = 'cdc-msg ' + (role === 'USER' ? 'user' : 'assistant');
    el.textContent = content;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) inputEl.focus();
  }
  bubble.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', togglePanel);

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || sending) return;
    appendMessage('USER', text);
    inputEl.value = '';
    sending = true;
    sendBtn.disabled = true;

    fetch(apiBase + '/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agentId,
        message: text,
        conversationId: conversationId || undefined,
        visitorRef: visitorRef,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data;
        if (!result.ok) {
          // Backend error responses are {message: '...'}, not {reply: '...'} —
          // surface the real reason (rate-limited, agent paused, etc.) instead
          // of always showing the generic fallback.
          appendMessage('ASSISTANT', data.message || 'Sorry, something went wrong.');
          return;
        }
        if (data.conversationId) {
          conversationId = data.conversationId;
          storeConversationId(conversationId);
        }
        appendMessage('ASSISTANT', data.reply || 'Sorry, something went wrong.');
      })
      .catch(function () {
        appendMessage('ASSISTANT', 'Sorry, something went wrong. Please try again.');
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = false;
      });
  }
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  // Fetch the agent's public cosmetic config (name/color/availability) —
  // never blocks the bubble from rendering; falls back to defaults if this
  // fails (e.g. this origin isn't in the agent's allowedOrigins).
  fetch(apiBase + '/v1/agents/' + encodeURIComponent(agentId) + '/config')
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data.primaryColor) applyColor(data.primaryColor);
      if (data.name) nameEl.textContent = data.name;
      if (data.available === false) {
        appendMessage('ASSISTANT', 'This assistant is temporarily unavailable. Please check back later.');
        inputEl.disabled = true;
        sendBtn.disabled = true;
      }
    })
    .catch(function () {});
})();
