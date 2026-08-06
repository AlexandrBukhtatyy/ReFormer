import { describe, it, expect } from 'vitest';
import { detectPlatform, formatShortcut, shortcutKeys } from './shortcuts';

describe('detectPlatform', () => {
  it('userAgentData.platform имеет приоритет над остальными подсказками', () => {
    expect(detectPlatform({ userAgentData: { platform: 'macOS' }, platform: 'Win32' })).toBe('mac');
    expect(detectPlatform({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' })).toBe(
      'other'
    );
  });

  it('fallback на navigator.platform, затем на userAgent', () => {
    expect(detectPlatform({ platform: 'MacIntel' })).toBe('mac');
    expect(detectPlatform({ platform: 'Win32' })).toBe('other');
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })).toBe(
      'mac'
    );
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).toBe(
      'other'
    );
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe('other');
  });

  it('без navigator и без подсказок — не-mac (Ctrl как более безопасный дефолт)', () => {
    expect(detectPlatform(undefined)).toBe('other');
    expect(detectPlatform({})).toBe('other');
  });
});

describe('shortcutKeys', () => {
  it('Mod — ⌘ на macOS, Ctrl на остальных', () => {
    expect(shortcutKeys('Mod+S', 'mac')).toEqual(['⌘', 'S']);
    expect(shortcutKeys('Mod+S', 'other')).toEqual(['Ctrl', 'S']);
  });

  it('порядок модификаторов нормализуется: ⌃⌥⇧⌘ на macOS, Ctrl+Alt+Shift на остальных', () => {
    expect(shortcutKeys('Shift+Mod+Alt+V', 'mac')).toEqual(['⌥', '⇧', '⌘', 'V']);
    expect(shortcutKeys('Shift+Mod+Alt+V', 'other')).toEqual(['Ctrl', 'Alt', 'Shift', 'V']);
    // запись в любом порядке даёт одну и ту же подпись
    expect(shortcutKeys('Mod+Alt+Shift+V', 'mac')).toEqual(shortcutKeys('Shift+Alt+Mod+V', 'mac'));
  });

  it('Ctrl — отдельный ⌃ на macOS, на остальных схлопывается с Mod', () => {
    expect(shortcutKeys('Mod+Ctrl+K', 'mac')).toEqual(['⌃', '⌘', 'K']);
    expect(shortcutKeys('Mod+Ctrl+K', 'other')).toEqual(['Ctrl', 'K']);
  });

  it('синонимы модификаторов: cmd/meta → Mod, option/opt → Alt', () => {
    expect(shortcutKeys('cmd+alt+B', 'mac')).toEqual(shortcutKeys('Mod+Option+B', 'mac'));
    expect(shortcutKeys('meta+D', 'other')).toEqual(['Ctrl', 'D']);
  });

  it('именованные клавиши: символ на macOS, слово на остальных', () => {
    expect(shortcutKeys('Enter', 'mac')).toEqual(['↵']);
    expect(shortcutKeys('Enter', 'other')).toEqual(['Enter']);
    expect(shortcutKeys('Backspace', 'mac')).toEqual(['⌫']);
    expect(shortcutKeys('Backspace', 'other')).toEqual(['Backspace']);
  });

  it('клавиши с общей подписью: стрелки, Esc, Space, Delete', () => {
    expect(shortcutKeys('Mod+ArrowUp', 'mac')).toEqual(['⌘', '↑']);
    expect(shortcutKeys('Mod+Arrows', 'other')).toEqual(['Ctrl', '↑↓←→']);
    expect(shortcutKeys('Escape', 'other')).toEqual(['Esc']);
    expect(shortcutKeys('Space', 'mac')).toEqual(['Space']);
    expect(shortcutKeys('Delete', 'mac')).toEqual(['Delete']);
  });

  it('одиночный символ — в верхний регистр, остальное как есть', () => {
    expect(shortcutKeys('Shift+f6', 'other')).toEqual(['Shift', 'f6']);
    expect(shortcutKeys('Mod+z', 'other')).toEqual(['Ctrl', 'Z']);
    expect(shortcutKeys('Mod+Alt+1', 'mac')).toEqual(['⌥', '⌘', '1']);
  });

  it('пробелы и пустые сегменты в записи игнорируются', () => {
    expect(shortcutKeys(' Mod + Shift + Z ', 'other')).toEqual(['Ctrl', 'Shift', 'Z']);
  });
});

describe('formatShortcut', () => {
  it('macOS — слитно, Windows/Linux — через +', () => {
    expect(formatShortcut('Mod+Shift+Z', 'mac')).toBe('⇧⌘Z');
    expect(formatShortcut('Mod+Shift+Z', 'other')).toBe('Ctrl+Shift+Z');
    expect(formatShortcut('Mod', 'mac')).toBe('⌘');
    expect(formatShortcut('Mod', 'other')).toBe('Ctrl');
  });
});
