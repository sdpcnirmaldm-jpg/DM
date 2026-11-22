import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextSidebarDesktopMode,
  parseSidebarDesktopMode,
} from './sidebarState';

test('parseSidebarDesktopMode validates known modes and falls back to expanded', () => {
  assert.equal(parseSidebarDesktopMode('expanded'), 'expanded');
  assert.equal(parseSidebarDesktopMode('minimized'), 'minimized');
  assert.equal(parseSidebarDesktopMode('hidden'), 'hidden');
  assert.equal(parseSidebarDesktopMode(null), 'expanded');
  assert.equal(parseSidebarDesktopMode(undefined), 'expanded');
  assert.equal(parseSidebarDesktopMode('invalid-value'), 'expanded');
});

test('nextSidebarDesktopMode transitions cleanly across expanded, minimized, and hidden', () => {
  assert.equal(nextSidebarDesktopMode('expanded', 'minimize'), 'minimized');
  assert.equal(nextSidebarDesktopMode('minimized', 'expand'), 'expanded');
  assert.equal(nextSidebarDesktopMode('hidden', 'expand'), 'expanded');
  assert.equal(nextSidebarDesktopMode('expanded', 'hide'), 'hidden');
  assert.equal(nextSidebarDesktopMode('minimized', 'hide'), 'hidden');
  assert.equal(nextSidebarDesktopMode('expanded', 'toggle-minimize'), 'minimized');
  assert.equal(nextSidebarDesktopMode('minimized', 'toggle-minimize'), 'expanded');
  assert.equal(nextSidebarDesktopMode('hidden', 'toggle-minimize'), 'minimized');
});
