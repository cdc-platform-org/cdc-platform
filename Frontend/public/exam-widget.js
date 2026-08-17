/*!
 * CDC AI Exam Proctoring — embeddable "Take Assessment" button.
 * <script src="https://cdc.org.ge/exam-widget.js" data-exam-token="EXAM_TOKEN" defer></script>
 * Vanilla JS, no dependencies. Renders inside a Shadow DOM so the host
 * page's CSS can never leak in — same isolation approach as widget.js
 * (the AI chat widget), just a link/button instead of a full chat UI since
 * an exam is taken on its own page, not embedded inline.
 */
(function () {
  'use strict';

  var currentScript = document.currentScript;
  if (!currentScript) return;

  var examToken = currentScript.getAttribute('data-exam-token');
  if (!examToken) {
    console.error('[CDC Exam Widget] Missing required data-exam-token attribute.');
    return;
  }

  var siteOrigin = new URL(currentScript.src).origin;
  var examUrl = siteOrigin + '/exam/' + encodeURIComponent(examToken);
  var label = currentScript.getAttribute('data-label') || 'Take Assessment';

  var host = document.createElement('div');
  host.id = 'cdc-exam-widget-root';
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

  var style = document.createElement('style');
  style.textContent = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
    '.cdc-exam-btn { position: fixed; bottom: 20px; right: 20px; padding: 14px 22px; border-radius: 999px; border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 2147483000; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #fff; background: linear-gradient(90deg, #06b6d4, #9333ea); text-decoration: none; transition: transform 0.2s ease; }',
    '.cdc-exam-btn:hover { transform: scale(1.04); }',
  ].join('\n');
  shadow.appendChild(style);

  var link = document.createElement('a');
  link.className = 'cdc-exam-btn';
  link.href = examUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg><span></span>';
  link.querySelector('span').textContent = label;
  shadow.appendChild(link);
})();
