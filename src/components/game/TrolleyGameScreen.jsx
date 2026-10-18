import { getOutlet } from '../../engine/calc.js';

/**
 * Placeholder student view, shown after a successful join. This wires the
 * end-to-end flow (join → outlet/reference assignment → here) without
 * pre-empting the actual shopping screen, which depends on Anita's still-
 * open calls: running total visible or hidden, and the pacing mitigation
 * (if any) for students at limited-choice outlets. Replace this component
 * with the real item-row/dropdown screen once those are settled — the
 * mockup built earlier (Main.dc.html / Convenience.dc.html) is the
 * starting point to adapt.
 */
export default function TrolleyGameScreen({ sessionId, trolleyConfig, outlet: outletId, referenceNumber }) {
  const outlet = getOutlet(trolleyConfig, outletId);

  return (
    <div className="loading-page">
      <div className="card" style={{ width: 420 }}>
        <div className="card-body" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Basket {referenceNumber}
          </div>
          <h2 style={{ margin: '6px 0 4px' }}>You're shopping at</h2>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, color: 'var(--orange)', marginBottom: 16 }}>
            {outlet?.name ?? outletId}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            The shopping screen itself is still being built — item choices,
            running total, and delivery options will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
