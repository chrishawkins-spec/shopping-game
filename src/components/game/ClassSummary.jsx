import React, { useEffect, useMemo, useState } from 'react';
import { subscribeTrolleyPlayers } from '../../utils/firestore.js';

/**
 * Teacher-facing scoreboard — adapts the earlier Design mockup
 * (ClassSummary.dc.html) into a real component wired to a live Firestore
 * subscription, so it updates as baskets come in (the technically-easy
 * default agreed in the spec's Open Questions — whether it should be
 * shown live or held back until everyone finishes is still Anita's call;
 * this component works either way, the caller just decides when to render it).
 *
 * Shows only reference numbers, outlet, fulfilment method and total — no
 * student name or nickname exists anywhere in the data to show.
 */
export default function ClassSummary({ sessionId }) {
  const [players, setPlayers] = useState([]);
  const [topN, setTopN] = useState(5);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeTrolleyPlayers(sessionId, setPlayers);
  }, [sessionId]);

  const completed = useMemo(
    () => players.filter(p => p.completedAt != null && p.grandTotal != null),
    [players]
  );

  const { cheapest, priciest, avgTotal, minTotal, maxTotal, promptRef } = useMemo(() => {
    if (completed.length === 0) {
      return { cheapest: [], priciest: [], avgTotal: null, minTotal: null, maxTotal: null, promptRef: null };
    }
    const sorted = [...completed].sort((a, b) => a.grandTotal - b.grandTotal);
    const withRank = (rows) => rows.map((r, i) => ({ ...r, rank: i + 1 }));
    const totals = completed.map(p => p.grandTotal);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return {
      cheapest: withRank(sorted.slice(0, topN)),
      priciest: withRank([...sorted].reverse().slice(0, topN)),
      avgTotal: avg.toFixed(2),
      minTotal: Math.min(...totals).toFixed(2),
      maxTotal: Math.max(...totals).toFixed(2),
      promptRef: sorted[0].referenceNumber,
    };
  }, [completed, topN]);

  return (
    <div style={{ padding: '2rem', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Shown by the teacher, class view
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: '1.8rem' }}>Class Summary</h1>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {completed.length} of {players.length} basket{players.length !== 1 ? 's' : ''} submitted
            {avgTotal != null && (
              <> · no names, reference numbers only · average £{avgTotal} · range £{minTotal}–£{maxTotal}</>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="form-label" style={{ margin: 0 }}>Show top</span>
          <select className="form-select" style={{ width: 70 }} value={topN} onChange={e => setTopN(Number(e.target.value))}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {completed.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
            No baskets submitted yet.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <RankedList title={`Cheapest ${topN}`} subtitle="lowest total cost" color="#3A6B52" rows={cheapest} />
            <RankedList title={`Most expensive ${topN}`} subtitle="highest total cost" color="#B4622E" rows={priciest} />
          </div>

          <div style={{ background: 'var(--navy-dark)', borderRadius: 12, padding: '14px 20px', marginTop: 20, color: '#D8D3C4', fontSize: '0.9rem' }}>
            Talking point: pick a reference number and ask the room —{' '}
            <span style={{ color: 'white', fontWeight: 600 }}>
              &ldquo;who was Basket {promptRef}? How did you keep your costs down?&rdquo;
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function RankedList({ title, subtitle, color, rows }) {
  return (
    <div className="card" style={{ flex: '1 1 320px', minWidth: 300 }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{subtitle}</div>
        </div>
        {rows.map(row => (
          <div key={row.referenceNumber} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, color: 'white',
              width: 26, height: 26, borderRadius: '50%', background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {row.rank}
            </div>
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Basket {row.referenceNumber}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                <span className="badge badge-gray">{row.outlet}</span>
                <span className="badge badge-gray">{row.fulfilment}</span>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color }}>
              £{row.grandTotal.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
