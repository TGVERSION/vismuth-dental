'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';

const HEADER_HEIGHT_PX = 36;
const ROW_HEIGHT_PX = 34;
const MAX_VISIBLE_ROWS = 10;
const MAX_TABLE_HEIGHT = HEADER_HEIGHT_PX + MAX_VISIBLE_ROWS * ROW_HEIGHT_PX;

export interface Column {
  id: string;
  name: string;
  width: number;
}

interface OverlayPos {
  left: number;
  top: number;
  visible: boolean;
}

interface TableEditorProps {
  columns: Column[];
  rows: string[][];
  onColumnsChange: (columns: Column[]) => void;
  onRowsChange: (rows: string[][]) => void;
  onScrollNearBottom?: () => void;
}

export function TableEditor({
  columns,
  rows,
  onColumnsChange,
  onRowsChange,
  onScrollNearBottom,
}: TableEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [plusColHovered, setPlusColHovered] = useState<number | null>(null);
  const [plusRowHovered, setPlusRowHovered] = useState<number | null>(null);
  const [hoveredDelBtn, setHoveredDelBtn] = useState<string | null>(null);
  const [colBtnPos, setColBtnPos] = useState<OverlayPos[]>([]);
  const [rowBtnPos, setRowBtnPos] = useState<OverlayPos[]>([]);

  const computePositions = useCallback(() => {
    const wrap = wrapRef.current;
    const outer = outerRef.current;
    const table = tableRef.current;
    if (!wrap || !outer || !table) return;

    const wrapRect = wrap.getBoundingClientRect();
    const outerRect = outer.getBoundingClientRect();
    const visLeft = outerRect.left - wrapRect.left;
    const visRight = outerRect.right - wrapRect.left;

    const headerCells = Array.from(
      table.querySelectorAll<HTMLTableCellElement>(
        'thead th:not([data-actions])',
      ),
    );
    setColBtnPos(
      headerCells.map((th) => {
        const r = th.getBoundingClientRect();
        const left = r.right - wrapRect.left - 9;
        return {
          left,
          top: outerRect.top - wrapRect.top - 9,
          visible: left >= visLeft - 9 && left <= visRight + 9,
        };
      }),
    );

    const bodyRows = Array.from(
      table.querySelectorAll<HTMLTableRowElement>('tbody tr'),
    );
    setRowBtnPos(
      bodyRows.map((tr) => {
        const r = tr.getBoundingClientRect();
        return {
          left: outerRect.left - wrapRect.left - 9,
          top: r.bottom - wrapRect.top - 9,
          visible: r.bottom >= outerRect.top && r.top <= outerRect.bottom,
        };
      }),
    );
  }, []);

  const colGeometry = columns.map((c) => `${c.id}:${c.width}`).join(',');
  useLayoutEffect(() => {
    computePositions();
  }, [columns.length, rows.length, colGeometry, computePositions]);

  const onScrollNearBottomRef = useRef(onScrollNearBottom);
  useEffect(() => {
    onScrollNearBottomRef.current = onScrollNearBottom;
  }, [onScrollNearBottom]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const onEvent = () => {
      requestAnimationFrame(computePositions);
      if (scroll) {
        const { scrollTop, scrollHeight, clientHeight } = scroll;
        if (scrollHeight - scrollTop - clientHeight < 80) {
          onScrollNearBottomRef.current?.();
        }
      }
    };
    scroll?.addEventListener('scroll', onEvent);
    window.addEventListener('resize', onEvent);
    return () => {
      scroll?.removeEventListener('scroll', onEvent);
      window.removeEventListener('resize', onEvent);
    };
  }, [computePositions]);

  const addColumn = useCallback(
    (afterIndex: number) => {
      const next = [...columns];
      next.splice(afterIndex + 1, 0, {
        id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `Колонка ${columns.length + 1}`,
        width: 150,
      });
      onColumnsChange(next);
      onRowsChange(
        rows.map((row) => {
          const r = [...row];
          r.splice(afterIndex + 1, 0, '');
          return r;
        }),
      );
    },
    [columns, rows, onColumnsChange, onRowsChange],
  );

  const deleteColumn = useCallback(
    (ci: number) => {
      if (columns.length === 1) return;
      onColumnsChange(columns.filter((_, i) => i !== ci));
      onRowsChange(rows.map((row) => row.filter((_, i) => i !== ci)));
    },
    [columns, rows, onColumnsChange, onRowsChange],
  );

  const renameColumn = useCallback(
    (ci: number, name: string) => {
      const next = [...columns];
      next[ci] = { ...next[ci], name };
      onColumnsChange(next);
    },
    [columns, onColumnsChange],
  );

  const addRow = useCallback(
    (afterIndex: number) => {
      const next = [...rows];
      next.splice(
        afterIndex + 1,
        0,
        columns.map(() => ''),
      );
      onRowsChange(next);
    },
    [rows, columns, onRowsChange],
  );

  const deleteRow = useCallback(
    (ri: number) => {
      if (rows.length === 1) return;
      onRowsChange(rows.filter((_, i) => i !== ri));
    },
    [rows, onRowsChange],
  );

  const updateCell = useCallback(
    (ri: number, ci: number, value: string) => {
      const next = rows.map((row) => [...row]);
      next[ri][ci] = value;
      onRowsChange(next);
    },
    [rows, onRowsChange],
  );

  const startResize = useCallback(
    (e: React.MouseEvent, ci: number) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = columnsRef.current[ci].width;

      const onMove = (ev: MouseEvent) => {
        const next = [...columnsRef.current];
        next[ci] = {
          ...next[ci],
          width: Math.max(60, startW + ev.clientX - startX),
        };
        onColumnsChange(next);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [onColumnsChange],
  );

  return (
    <div ref={wrapRef} className="relative pt-2.25">
      <div
        ref={outerRef}
        className="border border-[#E5E7EB] rounded-lg overflow-hidden"
      >
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: MAX_TABLE_HEIGHT }}
        >
          <table ref={tableRef} className="border-collapse w-full table-fixed">

            <thead>
              <tr>
                {columns.map((col, ci) => (
                  <th
                    key={col.id}
                    style={{ width: col.width }}
                    className={`sticky top-0 z-5 min-w-15 border-r border-b border-[#E5E7EB] h-9 p-0 font-medium text-[13px] text-[#202020] select-none relative ${hoveredCol === ci ? 'bg-[#F1F3F9]' : 'bg-[#F9FAFB]'}`}
                    onMouseEnter={() => setHoveredCol(ci)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div className="flex items-center pl-3 pr-6 h-full">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => renameColumn(ci, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex-1 text-[13px] font-medium border-none bg-transparent text-[#202020] outline-none cursor-text min-w-0 p-0 w-full"
                        style={{ fontFamily: 'inherit' }}
                      />
                    </div>

                    {hoveredCol === ci && (
                      <button
                        type="button"
                        onClick={() => deleteColumn(ci)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseEnter={() => setHoveredDelBtn(`col-${ci}`)}
                        onMouseLeave={() => setHoveredDelBtn(null)}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-none cursor-pointer text-[11px] inline-flex items-center justify-center p-0 leading-none ${hoveredDelBtn === `col-${ci}` ? 'bg-[#FEE2E2] text-[#EF4444]' : 'bg-transparent text-[#BDBDBD]'}`}
                      >
                        ✕
                      </button>
                    )}

                    <div
                      onMouseDown={(e) => startResize(e, ci)}
                      className="absolute -right-0.75 top-0 bottom-0 w-1.5 cursor-col-resize z-10"
                    />
                  </th>
                ))}

                <th
                  data-actions="true"
                  style={{ borderLeftStyle: 'hidden' }}
                  className="w-9 min-w-9 sticky top-0 z-5 bg-[#F9FAFB] border-r-0 border-b border-[#E5E7EB] h-9 p-0"
                />
              </tr>
            </thead>

            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={hoveredRow === ri ? 'bg-[#FAFBFF]' : ''}
                  onMouseEnter={() => setHoveredRow(ri)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-r border-b border-[#E5E7EB] relative p-0"
                      style={{ height: ROW_HEIGHT_PX }}
                    >
                      <div
                        onMouseDown={(e) => startResize(e, ci)}
                        className="absolute -right-0.75 top-0 bottom-0 w-1.5 cursor-col-resize z-10"
                      />
                      <input
                        type="text"
                        value={cell}
                        placeholder="—"
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className="block w-full h-full border-none px-3 text-[13px] text-[#202020] bg-transparent outline-none"
                        style={{ fontFamily: 'inherit' }}
                      />
                    </td>
                  ))}
                  <td
                    style={{ borderLeftStyle: 'hidden' }}
                    className="border-r-0 border-b border-[#E5E7EB] w-9 min-w-9 p-0 text-center align-middle"
                  >
                    <button
                      type="button"
                      onClick={() => deleteRow(ri)}
                      onMouseEnter={() => setHoveredDelBtn(`row-${ri}`)}
                      onMouseLeave={() => setHoveredDelBtn(null)}
                      className={`w-5 h-5 rounded-full border-none cursor-pointer text-[11px] inline-flex items-center justify-center p-0 leading-none transition-opacity ${hoveredRow === ri ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} ${hoveredDelBtn === `row-${ri}` ? 'bg-[#FEE2E2] text-[#EF4444]' : 'bg-transparent text-[#BDBDBD]'}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {colBtnPos.map((pos, ci) =>
        (hoveredCol === ci || plusColHovered === ci) && pos.visible ? (
          <button
            key={`col-plus-${ci}`}
            type="button"
            onClick={() => addColumn(ci)}
            onMouseEnter={() => setPlusColHovered(ci)}
            onMouseLeave={() => setPlusColHovered(null)}
            className="absolute w-4.5 h-4.5 rounded-full bg-[#5D8CF1] text-white border-none text-[13px] cursor-pointer flex items-center justify-center shadow-[0_1px_4px_rgba(93,140,241,0.5)] z-30 p-0 leading-none"
            style={{ left: pos.left, top: pos.top }}
          >
            +
          </button>
        ) : null,
      )}

      {rowBtnPos.map((pos, ri) =>
        (hoveredRow === ri || plusRowHovered === ri) && pos.visible ? (
          <button
            key={`row-plus-${ri}`}
            type="button"
            onClick={() => addRow(ri)}
            onMouseEnter={() => setPlusRowHovered(ri)}
            onMouseLeave={() => setPlusRowHovered(null)}
            className="absolute w-4.5 h-4.5 rounded-full bg-[#5D8CF1] text-white border-none text-[13px] cursor-pointer flex items-center justify-center shadow-[0_1px_4px_rgba(93,140,241,0.5)] z-30 p-0 leading-none"
            style={{ left: pos.left, top: pos.top }}
          >
            +
          </button>
        ) : null,
      )}
    </div>
  );
}
