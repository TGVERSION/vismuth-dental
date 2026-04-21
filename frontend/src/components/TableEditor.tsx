'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';
import React from 'react';

// Fix 7 — Magic number constants
const HEADER_HEIGHT_PX = 36;
const ROW_HEIGHT_PX = 34;
const MAX_VISIBLE_ROWS = 10;

// Fix 6 — Module-level style constants
const PLUS_BTN_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 18, height: 18, borderRadius: '50%',
  background: '#5D8CF1', color: '#fff', border: 'none',
  fontSize: 13, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 1px 4px rgba(93,140,241,0.5)',
  zIndex: 30, padding: 0, lineHeight: 1,
};

const DEL_CIRCLE_STYLE: React.CSSProperties = {
  width: 20, height: 20, borderRadius: '50%',
  border: 'none', background: 'transparent', color: '#BDBDBD',
  cursor: 'pointer', fontSize: 11,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, lineHeight: 1,
};

// Fix 3 — Stable id on Column interface
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
}

export function TableEditor({
  columns,
  rows,
  onColumnsChange,
  onRowsChange,
}: TableEditorProps) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const outerRef  = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef  = useRef<HTMLTableElement>(null);

  // Fix 1 — Ref to avoid stale columns snapshot in startResize
  const columnsRef = useRef(columns);
  useEffect(() => { columnsRef.current = columns; }, [columns]);

  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  // Separate hover state for the + buttons so they stay visible when
  // the mouse moves from the th/tr onto the button
  const [plusColHovered, setPlusColHovered] = useState<number | null>(null);
  const [plusRowHovered, setPlusRowHovered] = useState<number | null>(null);

  // Fix 5 — React state for delete button hover
  const [hoveredDelBtn, setHoveredDelBtn] = useState<string | null>(null);

  const [colBtnPos, setColBtnPos] = useState<OverlayPos[]>([]);
  const [rowBtnPos, setRowBtnPos] = useState<OverlayPos[]>([]);

  // ── Position computation ───────────────────────────────────────────────
  const computePositions = useCallback(() => {
    const wrap  = wrapRef.current;
    const outer = outerRef.current;
    const table = tableRef.current;
    if (!wrap || !outer || !table) return;

    const wrapRect  = wrap.getBoundingClientRect();
    const outerRect = outer.getBoundingClientRect();
    const visLeft   = outerRect.left  - wrapRect.left;
    const visRight  = outerRect.right - wrapRect.left;

    // Column + buttons: centred on TOP border of table, at right edge of each th
    const headerCells = Array.from(
      table.querySelectorAll<HTMLTableCellElement>('thead th:not([data-actions])')
    );
    setColBtnPos(
      headerCells.map((th) => {
        const r    = th.getBoundingClientRect();
        const left = r.right - wrapRect.left - 9;
        return {
          left,
          top: outerRect.top - wrapRect.top - 9,
          visible: left >= visLeft - 9 && left <= visRight + 9,
        };
      })
    );

    // Row + buttons: centred on BOTTOM border of each tr, left of table
    const bodyRows = Array.from(
      table.querySelectorAll<HTMLTableRowElement>('tbody tr')
    );
    setRowBtnPos(
      bodyRows.map((tr) => {
        const r = tr.getBoundingClientRect();
        return {
          left: outerRect.left - wrapRect.left - 9,
          top:  r.bottom - wrapRect.top - 9,
          visible: r.bottom >= outerRect.top && r.top <= outerRect.bottom,
        };
      })
    );
  }, []);

  // Fix 4 — Only recompute on geometry changes, not row content changes
  const colGeometry = columns.map((c) => `${c.id}:${c.width}`).join(',');
  useLayoutEffect(() => {
    computePositions();
    // Only geometry changes (column count, widths, row count) affect overlay positions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length, rows.length, colGeometry, computePositions]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const onEvent = () => requestAnimationFrame(computePositions);
    scroll?.addEventListener('scroll', onEvent);
    window.addEventListener('resize', onEvent);
    return () => {
      scroll?.removeEventListener('scroll', onEvent);
      window.removeEventListener('resize', onEvent);
    };
  }, [computePositions]);

  // ── Column operations ──────────────────────────────────────────────────
  const addColumn = useCallback(
    (afterIndex: number) => {
      const next = [...columns];
      // Fix 3 — Generate stable id for new columns
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
        })
      );
    },
    [columns, rows, onColumnsChange, onRowsChange]
  );

  const deleteColumn = useCallback(
    (ci: number) => {
      if (columns.length === 1) return;
      onColumnsChange(columns.filter((_, i) => i !== ci));
      onRowsChange(rows.map((row) => row.filter((_, i) => i !== ci)));
    },
    [columns, rows, onColumnsChange, onRowsChange]
  );

  const renameColumn = useCallback(
    (ci: number, name: string) => {
      const next = [...columns];
      next[ci] = { ...next[ci], name };
      onColumnsChange(next);
    },
    [columns, onColumnsChange]
  );

  // ── Row operations ─────────────────────────────────────────────────────
  const addRow = useCallback(
    (afterIndex: number) => {
      const next = [...rows];
      next.splice(afterIndex + 1, 0, columns.map(() => ''));
      onRowsChange(next);
    },
    [rows, columns, onRowsChange]
  );

  const deleteRow = useCallback(
    (ri: number) => {
      if (rows.length === 1) return;
      onRowsChange(rows.filter((_, i) => i !== ri));
    },
    [rows, onRowsChange]
  );

  const updateCell = useCallback(
    (ri: number, ci: number, value: string) => {
      const next = rows.map((row) => [...row]);
      next[ri][ci] = value;
      onRowsChange(next);
    },
    [rows, onRowsChange]
  );

  // ── Column resize ──────────────────────────────────────────────────────
  const startResize = useCallback(
    (e: React.MouseEvent, ci: number) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = columnsRef.current[ci].width;

      // Fix 1 — Use columnsRef to avoid stale closure over columns
      const onMove = (ev: MouseEvent) => {
        const next = [...columnsRef.current];
        next[ci] = { ...next[ci], width: Math.max(60, startW + ev.clientX - startX) };
        onColumnsChange(next);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [onColumnsChange]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} style={{ position: 'relative', paddingTop: 9 }}>
      {/* Table */}
      <div
        ref={outerRef}
        style={{
          border: '1px solid #E5E7EB',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div
          ref={scrollRef}
          style={{
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: `calc(${HEADER_HEIGHT_PX}px + ${MAX_VISIBLE_ROWS} * ${ROW_HEIGHT_PX}px)`,
          }}
        >
          <table
            ref={tableRef}
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              tableLayout: 'fixed',
            }}
          >
            {/* ── Header ── */}
            <thead>
              <tr>
                {/* Fix 3 — Use col.id as React key */}
                {columns.map((col, ci) => (
                  <th
                    key={col.id}
                    style={{
                      width: col.width,
                      minWidth: 60,
                      position: 'sticky',
                      top: 0,
                      zIndex: 5,
                      background: hoveredCol === ci ? '#F1F3F9' : '#F9FAFB',
                      borderRight: '1px solid #E5E7EB',
                      borderBottom: '1px solid #E5E7EB',
                      height: HEADER_HEIGHT_PX,
                      padding: 0,
                      fontWeight: 500,
                      fontSize: 13,
                      color: '#202020',
                      userSelect: 'none',
                    }}
                    onMouseEnter={() => setHoveredCol(ci)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    {/* Fix 2 — Controlled input instead of contentEditable */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 24px 0 12px',
                        height: '100%',
                      }}
                    >
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => renameColumn(ci, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: 500,
                          border: 'none',
                          background: 'transparent',
                          color: '#202020',
                          fontFamily: 'inherit',
                          outline: 'none',
                          cursor: 'text',
                          minWidth: 0,
                          padding: 0,
                          width: '100%',
                        }}
                      />
                    </div>

                    {/* Column delete ✕ */}
                    {/* Fix 5 — React state-driven hover instead of direct DOM mutation */}
                    {hoveredCol === ci && (
                      <button
                        type="button"
                        onClick={() => deleteColumn(ci)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseEnter={() => setHoveredDelBtn(`col-${ci}`)}
                        onMouseLeave={() => setHoveredDelBtn(null)}
                        style={{
                          ...DEL_CIRCLE_STYLE,
                          position: 'absolute',
                          right: 6,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: hoveredDelBtn === `col-${ci}` ? '#FEE2E2' : 'transparent',
                          color: hoveredDelBtn === `col-${ci}` ? '#EF4444' : '#BDBDBD',
                        }}
                      >
                        ✕
                      </button>
                    )}

                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => startResize(e, ci)}
                      style={{
                        position: 'absolute',
                        right: -3,
                        top: 0,
                        bottom: 0,
                        width: 6,
                        cursor: 'col-resize',
                        zIndex: 10,
                      }}
                    />
                  </th>
                ))}

                {/* Actions column header */}
                <th
                  data-actions="true"
                  style={{
                    width: 36,
                    minWidth: 36,
                    position: 'sticky',
                    top: 0,
                    zIndex: 5,
                    background: '#F9FAFB',
                    borderRight: 'none',
                    borderLeftStyle: 'hidden',
                    borderBottom: '1px solid #E5E7EB',
                    height: HEADER_HEIGHT_PX,
                    padding: 0,
                  }}
                />
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    background: hoveredRow === ri ? '#FAFBFF' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredRow(ri)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        borderRight: '1px solid #E5E7EB',
                        borderBottom: '1px solid #E5E7EB',
                        height: ROW_HEIGHT_PX,
                        padding: 0,
                        position: 'relative',
                      }}
                    >
                      {/* Resize handle on body cells */}
                      <div
                        onMouseDown={(e) => startResize(e, ci)}
                        style={{
                          position: 'absolute',
                          right: -3,
                          top: 0,
                          bottom: 0,
                          width: 6,
                          cursor: 'col-resize',
                          zIndex: 10,
                        }}
                      />
                      <input
                        type="text"
                        value={cell}
                        placeholder="—"
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          padding: '0 12px',
                          fontSize: 13,
                          color: '#202020',
                          background: 'transparent',
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                    </td>
                  ))}

                  {/* Actions cell — row delete */}
                  {/* Fix 5 — React state-driven hover instead of direct DOM mutation */}
                  <td
                    style={{
                      borderRight: 'none',
                      borderLeftStyle: 'hidden',
                      borderBottom: '1px solid #E5E7EB',
                      width: 36,
                      minWidth: 36,
                      padding: 0,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => deleteRow(ri)}
                      onMouseEnter={() => setHoveredDelBtn(`row-${ri}`)}
                      onMouseLeave={() => setHoveredDelBtn(null)}
                      style={{
                        ...DEL_CIRCLE_STYLE,
                        opacity: hoveredRow === ri ? 1 : 0,
                        pointerEvents: hoveredRow === ri ? 'all' : 'none',
                        background: hoveredDelBtn === `row-${ri}` ? '#FEE2E2' : 'transparent',
                        color: hoveredDelBtn === `row-${ri}` ? '#EF4444' : '#BDBDBD',
                      }}
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

      {/* Overlay — column + buttons */}
      {colBtnPos.map((pos, ci) =>
        (hoveredCol === ci || plusColHovered === ci) && pos.visible ? (
          <button
            key={`col-plus-${ci}`}
            type="button"
            onClick={() => addColumn(ci)}
            onMouseEnter={() => setPlusColHovered(ci)}
            onMouseLeave={() => setPlusColHovered(null)}
            style={{ ...PLUS_BTN_STYLE, left: pos.left, top: pos.top }}
          >
            +
          </button>
        ) : null
      )}

      {/* Overlay — row + buttons */}
      {rowBtnPos.map((pos, ri) =>
        (hoveredRow === ri || plusRowHovered === ri) && pos.visible ? (
          <button
            key={`row-plus-${ri}`}
            type="button"
            onClick={() => addRow(ri)}
            onMouseEnter={() => setPlusRowHovered(ri)}
            onMouseLeave={() => setPlusRowHovered(null)}
            style={{ ...PLUS_BTN_STYLE, left: pos.left, top: pos.top }}
          >
            +
          </button>
        ) : null
      )}
    </div>
  );
}
