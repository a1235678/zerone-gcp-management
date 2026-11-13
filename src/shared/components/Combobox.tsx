import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface ComboOption {
  value: string;
  label: string;
  /** 顯示在名稱下方的補充文字，也會被搜尋 */
  hint?: string;
  /** 只用來搜尋、不顯示的字（例如統編、簡稱） */
  keywords?: string[];
}

/**
 * 可以輸入搜尋的下拉選單：點開或打字就列出符合的選項，可用上下鍵與 Enter 選擇。
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = '輸入名稱搜尋',
  emptyText = '找不到符合的項目',
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  emptyText?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const [text, setText] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // 外部改了選取值時，輸入框跟著顯示
  useEffect(() => {
    if (!open) setText(selected?.label ?? '');
  }, [selected?.label, open]);

  const matches = useMemo(() => {
    const kw = text.trim().toLowerCase();
    if (!kw || kw === selected?.label.toLowerCase()) return options;
    return options.filter((o) => [o.label, o.hint, ...(o.keywords ?? [])].some((f) => f?.toLowerCase().includes(kw)));
  }, [text, options, selected?.label]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
        setText(selected?.label ?? '');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, selected?.label]);

  const pick = (o: ComboOption) => {
    onChange(o.value);
    setText(o.label);
    setOpen(false);
  };

  return (
    <div className="combobox" ref={wrap}>
      <span className="input-icon">
        <Icon name="search" size={16} />
        <input
          id={id}
          className="input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onFocus={(e) => {
            setOpen(true);
            setActive(0);
            e.target.select();
          }}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
            if (!e.target.value) onChange('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              if (open && matches[active]) {
                e.preventDefault();
                pick(matches[active]);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
              setText(selected?.label ?? '');
            }
          }}
        />
      </span>
      {open && (
        <ul className="combobox__list" id={listId} role="listbox">
          {matches.length === 0 && <li className="combobox__empty">{emptyText}</li>}
          {matches.slice(0, 50).map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`combobox__option ${i === active ? 'is-active' : ''} ${o.value === value ? 'is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
            >
              <span>{o.label}</span>
              {o.hint && <span className="combobox__hint">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
