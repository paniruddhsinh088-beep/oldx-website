import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

function extractBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test('AI chatbot renders user input and reply through text nodes', () => {
  const block = extractBetween('function sendAiMessage()', 'function handleOldxWhatsApp');
  assert.match(block, /userMessageText\.textContent\s*=\s*msg/);
  assert.match(block, /aiReplyText\.textContent\s*=/);
  assert.match(block, /userMessageText\.style\.whiteSpace\s*=\s*["']pre-wrap["']/);
  assert.doesNotMatch(block, /userCard\.innerHTML\s*=|aiCard\.innerHTML\s*=/);
});

test('Inbox preview and timestamp are rendered as text, not interpolated HTML', () => {
  const block = extractBetween('function openInboxModal()', 'function closeInboxModal()');
  assert.match(block, /preview\.textContent\s*=\s*String\(lastMsgText\)/);
  assert.match(block, /timeLabel\.textContent\s*=\s*String\(lastTime\)/);
  assert.match(block, /unreadBadge\.textContent\s*=\s*String\(item\.unreadCount\)/);
  assert.doesNotMatch(block, /\$\{lastMsgText\}|\$\{lastTime\}|\$\{item\.unreadCount\}/);
});
