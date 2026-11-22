// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FileUploadBase } from './index';

afterEach(cleanup);

const pdf = new File([new Uint8Array(8)], 'report.pdf', { type: 'application/pdf' });

/** DataTransfer с файлом: в dragenter браузер отдаёт только `types`, в drop — и `files`. */
const transfer = { files: [pdf], types: ['Files'] };

const button = () => screen.getByRole('button', { name: 'Choose files' });

describe('FileUploadBase (DOM): allowDrop / allowPaste у варианта-кнопки', () => {
  it('файл, брошенный на кнопку, попадает в значение (allowDrop по умолчанию true)', () => {
    const onChange = vi.fn();
    render(<FileUploadBase value={null} onChange={onChange} />);
    fireEvent.dragEnter(button(), { dataTransfer: transfer });
    expect(button().hasAttribute('data-dragging')).toBe(true);
    fireEvent.drop(button(), { dataTransfer: transfer });
    expect(onChange).toHaveBeenCalledWith([pdf]);
    expect(button().hasAttribute('data-dragging')).toBe(false);
  });

  it('allowDrop={false} — drop на кнопку игнорируется', () => {
    const onChange = vi.fn();
    render(<FileUploadBase value={null} onChange={onChange} allowDrop={false} />);
    fireEvent.drop(button(), { dataTransfer: transfer });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('allowPaste — файл из буфера, вставленный в сфокусированную кнопку', () => {
    const onChange = vi.fn();
    render(<FileUploadBase value={null} onChange={onChange} allowPaste />);
    fireEvent.paste(button(), { clipboardData: { files: [pdf] } });
    expect(onChange).toHaveBeenCalledWith([pdf]);
  });

  it('allowPaste по умолчанию выключен', () => {
    const onChange = vi.fn();
    render(<FileUploadBase value={null} onChange={onChange} />);
    fireEvent.paste(button(), { clipboardData: { files: [pdf] } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disabled — ни drop, ни paste', () => {
    const onChange = vi.fn();
    render(<FileUploadBase value={null} onChange={onChange} allowPaste disabled />);
    fireEvent.drop(button(), { dataTransfer: transfer });
    fireEvent.paste(button(), { clipboardData: { files: [pdf] } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
