// src/components/StreamViewer.jsx
// Stream picker has moved to MatchStatusBar — this component is just the iframe.

export default function StreamViewer({ currentStreamEvent, eventData }) {
    if (!currentStreamEvent) {
        return (
            <div style={S.empty}>
                <div style={S.emptyIcon}>📺</div>
                <div style={S.emptyTitle}>No Stream Selected</div>
                <div style={S.emptySub}>
                    Add favorite teams in Settings, or select an event from the sidebar.
                </div>
            </div>
        );
    }

    const edata      = eventData[currentStreamEvent] || {};
    const streams    = edata.streams || [];
    const activeIdx  = edata.activeStreamIdx ?? (streams.length > 0 ? streams.length - 1 : 0);
    const activeUrl  = edata.activeStream || streams[activeIdx]?.url;

    const resolvedUrl = activeUrl
        ? activeUrl.replace('HOSTNAME', window.location.hostname)
        : null;

    if (!resolvedUrl) {
        return (
            <div style={S.empty}>
                <div style={S.emptyIcon}>📡</div>
                <div style={S.emptyTitle}>{edata.shortName || edata.name || currentStreamEvent}</div>
                <div style={S.emptySub}>No stream available for this event.</div>
            </div>
        );
    }

    return (
        <div style={S.wrapper}>
            <iframe
                key={resolvedUrl}
                src={resolvedUrl}
                style={S.iframe}
                allowFullScreen
                allow="autoplay; fullscreen"
                title={`${edata.shortName || currentStreamEvent} stream`}
                frameBorder="0"
            />
        </div>
    );
}

const S = {
    wrapper: {
        flex: 1, background: '#000',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
    },
    iframe: {
        width: '100%', flex: 1, border: 'none', display: 'block',
    },
    empty: {
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#070b14', padding: 40, textAlign: 'center',
    },
    emptyIcon:  { fontSize: 56, marginBottom: 16, opacity: 0.2 },
    emptyTitle: {
        color: '#374151', fontSize: 18, fontWeight: 700, marginBottom: 8,
        fontFamily: "'Barlow Condensed', sans-serif",
        textTransform: 'uppercase', letterSpacing: '0.08em',
    },
    emptySub: { color: '#1e3a5f', fontSize: 13, maxWidth: 320, lineHeight: 1.6 },
};