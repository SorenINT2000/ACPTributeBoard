import { useState } from 'react';
import { Button, Badge } from 'react-bootstrap';
import { Search, XCircle } from 'react-bootstrap-icons';

export interface DebugInfo {
    activeSubscriptions: string[];
    visiblePostIds: string[];
    totalLoadedPosts: number;
}

interface DebugOverlayProps {
    debugInfo: DebugInfo;
    posts: Array<{ id: string }>;
}

/**
 * Debug overlay component for visualizing sliding window subscription state.
 * Shows active Firebase subscriptions, visible posts, and their positions.
 */
export function DebugOverlay({ debugInfo, posts }: DebugOverlayProps) {
    const [isVisible, setIsVisible] = useState(false);

    // Get short ID for display
    const shortId = (id: string) => {
        const parts = id.split('_');
        return parts.length > 2 ? `...${parts[2].slice(-4)}` : id.slice(-8);
    };

    // Create a map of post positions
    const postPositions = new Map(posts.map((p, idx) => [p.id, idx]));

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 9999,
                fontFamily: 'Monaco, Consolas, monospace',
                fontSize: 11,
            }}
        >
            {/* Toggle button */}
            <Button
                variant="dark"
                size="sm"
                onClick={() => setIsVisible(!isVisible)}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    opacity: 0.9,
                }}
            >
                {isVisible ? <XCircle /> : <Search />}
            </Button>

            {/* Overlay panel */}
            {isVisible && (
                <div
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        color: '#00ff00',
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 40,
                        maxHeight: '60vh',
                        overflowY: 'auto',
                        minWidth: 280,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    }}
                >
                    <div style={{ marginBottom: 12, borderBottom: '1px solid #333', paddingBottom: 8 }}>
                        <strong style={{ color: '#fff' }}>📊 Sliding Window Debug</strong>
                    </div>

                    {/* Summary stats */}
                    <div style={{ marginBottom: 12 }}>
                        <div>
                            <Badge bg="primary" style={{ marginRight: 4 }}>
                                {debugInfo.totalLoadedPosts}
                            </Badge>
                            Posts loaded
                        </div>
                        <div>
                            <Badge bg="success" style={{ marginRight: 4 }}>
                                {debugInfo.activeSubscriptions.length}
                            </Badge>
                            Active subscriptions
                        </div>
                        <div>
                            <Badge bg="info" style={{ marginRight: 4 }}>
                                {debugInfo.visiblePostIds.length}
                            </Badge>
                            Visible in viewport
                        </div>
                    </div>

                    {/* Active subscriptions list */}
                    <div style={{ marginBottom: 8 }}>
                        <strong style={{ color: '#0f0' }}>🔗 Active Subscriptions:</strong>
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
                        {debugInfo.activeSubscriptions.length === 0 ? (
                            <div style={{ color: '#666' }}>None</div>
                        ) : (
                            debugInfo.activeSubscriptions
                                .sort((a, b) => (postPositions.get(a) ?? 999) - (postPositions.get(b) ?? 999))
                                .map((id) => {
                                    const pos = postPositions.get(id);
                                    const isVisiblePost = debugInfo.visiblePostIds.includes(id);
                                    return (
                                        <div
                                            key={id}
                                            style={{
                                                padding: '2px 4px',
                                                backgroundColor: isVisiblePost ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
                                                borderLeft: isVisiblePost ? '2px solid #0f0' : '2px solid transparent',
                                                marginBottom: 1,
                                            }}
                                        >
                                            <span style={{ color: '#888', marginRight: 8 }}>
                                                #{pos !== undefined ? pos : '?'}
                                            </span>
                                            <span style={{ color: isVisiblePost ? '#0f0' : '#666' }}>
                                                {shortId(id)}
                                            </span>
                                            {isVisiblePost && (
                                                <span style={{ color: '#0f0', marginLeft: 4 }}>👁</span>
                                            )}
                                        </div>
                                    );
                                })
                        )}
                    </div>

                    {/* Legend */}
                    <div style={{ fontSize: 10, color: '#666', borderTop: '1px solid #333', paddingTop: 8 }}>
                        <div>👁 = Currently visible</div>
                        <div style={{ backgroundColor: 'rgba(0, 255, 0, 0.2)', display: 'inline-block', padding: '0 4px' }}>
                            Green
                        </div>
                        {' '}= In viewport
                    </div>
                </div>
            )}
        </div>
    );
}

export default DebugOverlay;
