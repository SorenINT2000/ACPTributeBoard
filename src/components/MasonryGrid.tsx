import { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback, type ReactNode } from 'react';

interface MasonryItem {
    id: string;
    /** Optional hint for estimated height calculation */
    contentLength?: number;
    /** Whether this item is newly added (for animation) */
    isNew?: boolean;
}

interface MasonryGridProps<T extends MasonryItem> {
    /** Array of items to display in the masonry grid */
    items: T[];
    /** Render function for each item */
    renderItem: (item: T, ref: (el: HTMLDivElement | null) => void) => ReactNode;
    /** Optional class name for the container */
    className?: string;
    /** Optional minimum number of columns (default: 1) */
    minColumns?: number;
    /** Optional maximum number of columns (default: 3) */
    maxColumns?: number;
    /** Gap between items in pixels (default: 16) */
    gap?: number;
    /** Optional sentinel ref to place at the bottom of the shortest column */
    sentinelRef?: (el: HTMLDivElement | null) => void;
    /** Whether to show the sentinel (typically when hasMore is true) */
    showSentinel?: boolean;
}

interface ItemWithColumn<T> extends MasonryItem {
    item: T;
    column: number;
}

/**
 * A reusable masonry grid component that distributes items across columns
 * based on their actual rendered heights for optimal space utilization.
 */
function MasonryGrid<T extends MasonryItem>({
    items,
    renderItem,
    className = '',
    minColumns = 1,
    maxColumns = 3,
    gap = 16,
    sentinelRef,
    showSentinel = false,
}: MasonryGridProps<T>) {
    const [itemHeights, setItemHeights] = useState<Record<string, number>>({});
    const [numColumns, setNumColumns] = useState<number>(maxColumns);
    const containerRef = useRef<HTMLDivElement>(null);

    // Use a mutable object for item refs (not a React ref) to avoid React 19's strict ref checks
    // This is safe because we only read from it in effects, not during render
    const [itemRefsStore] = useState<{ refs: Record<string, HTMLDivElement | null> }>(() => ({ refs: {} }));

    // Responsive column count based on screen size
    useLayoutEffect(() => {
        const updateColumns = () => {
            const width = window.innerWidth;
            let cols: number;
            if (width < 576) {
                cols = minColumns;
            } else if (width < 992) {
                cols = Math.min(2, maxColumns);
            } else {
                cols = maxColumns;
            }
            setNumColumns(Math.max(minColumns, Math.min(cols, maxColumns)));
        };

        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, [minColumns, maxColumns]);

    // Measure item heights for masonry layout
    useEffect(() => {
        if (items.length === 0) {
            requestAnimationFrame(() => setItemHeights({}));
            return;
        }

        const measureHeights = () => {
            const heights: Record<string, number> = {};
            Object.entries(itemRefsStore.refs).forEach(([id, element]) => {
                if (element) heights[id] = element.offsetHeight;
            });

            const heightsChanged = Object.keys(heights).some(
                (id) => heights[id] !== itemHeights[id]
            ) || Object.keys(itemHeights).length !== Object.keys(heights).length;

            if (heightsChanged && Object.keys(heights).length > 0) {
                setItemHeights(heights);
            }
        };

        requestAnimationFrame(measureHeights);
    }, [items, itemHeights, itemRefsStore.refs]);

    // ResizeObserver for dynamic height changes
    useEffect(() => {
        if (typeof ResizeObserver === 'undefined' || items.length === 0) return;

        const observer = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                const heights: Record<string, number> = {};
                Object.entries(itemRefsStore.refs).forEach(([id, element]) => {
                    if (element) heights[id] = element.offsetHeight;
                });

                const heightsChanged = Object.keys(heights).some(
                    (id) => heights[id] !== itemHeights[id]
                ) || Object.keys(itemHeights).length !== Object.keys(heights).length;

                if (heightsChanged && Object.keys(heights).length > 0) {
                    setItemHeights(heights);
                }
            });
        });

        Object.values(itemRefsStore.refs).forEach((element) => {
            if (element && containerRef.current?.contains(element)) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [items, itemHeights, itemRefsStore.refs]);

    // Distribute items across columns (masonry algorithm)
    const itemsWithColumns = useMemo(() => {
        const columnHeights = new Array(numColumns).fill(0);
        const itemsWithCols: ItemWithColumn<T>[] = [];

        items.forEach((item) => {
            // Use actual height if measured, otherwise estimate based on content length
            const height = itemHeights[item.id] || Math.max(200, (item.contentLength || 100) / 10);
            const minHeight = Math.min(...columnHeights);
            const columnIndex = columnHeights.indexOf(minHeight);

            itemsWithCols.push({ ...item, item, column: columnIndex });
            columnHeights[columnIndex] += height + gap;
        });

        return itemsWithCols;
    }, [items, itemHeights, numColumns, gap]);

    // Group items by column and calculate column heights
    const { columns, shortestColumnIndex } = useMemo(() => {
        const columnArrays: ItemWithColumn<T>[][] = Array.from({ length: numColumns }, () => []);
        const heights = new Array(numColumns).fill(0);

        itemsWithColumns.forEach((itemWithCol) => {
            if (itemWithCol.column >= 0 && itemWithCol.column < numColumns) {
                columnArrays[itemWithCol.column].push(itemWithCol);
                const height = itemHeights[itemWithCol.id] || Math.max(200, ((itemWithCol.contentLength || 100) / 10));
                heights[itemWithCol.column] += height + gap;
            }
        });

        const shortestIndex = heights.indexOf(Math.min(...heights));
        return { columns: columnArrays, shortestColumnIndex: shortestIndex };
    }, [itemsWithColumns, numColumns, itemHeights, gap]);

    // Create ref callback for each item
    // Using a stable mutable object (not useRef) to avoid React 19's strict ref checks
    const getItemRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
        itemRefsStore.refs[id] = el;
    }, [itemRefsStore]);

    return (
        <div
            ref={containerRef}
            className={`masonry-grid ${className}`}
            style={{
                display: 'flex',
                gap: `${gap}px`,
            }}
        >
            {columns.map((columnItems, columnIndex) => {
                const isShortestColumn = columnIndex === shortestColumnIndex;
                return (
                    <div
                        key={columnIndex}
                        className="masonry-column"
                        style={{
                            flex: '1 1 0',
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: `${gap}px`,
                        }}
                    >
                        {columnItems.map(({ item, id }) => (
                            <div key={id}>
                                {renderItem(item, getItemRef(id))}
                            </div>
                        ))}
                        {/* Place sentinel at the bottom of the shortest column */}
                        {showSentinel && isShortestColumn && sentinelRef ? (
                            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

export default MasonryGrid;
export type { MasonryItem, MasonryGridProps };
