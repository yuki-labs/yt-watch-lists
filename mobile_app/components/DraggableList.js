import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    FlatList,
    PanResponder,
    Animated,
    LayoutAnimation,
    Vibration,
} from 'react-native';

/**
 * Drag-to-reorder FlatList.
 *
 * PanResponder lives on the drag handle (⋮ button) inside items.
 * Zero state updates during the active drag gesture.
 *
 * RefreshControl conflict resolution:
 *   - RefreshControl's `enabled` prop is toggled to false when drag activates
 *   - This calls SwipeRefreshLayout.setEnabled(false) natively WITHOUT
 *     changing the view hierarchy (no re-mount, no orphaning)
 *   - The `enabled` state setter is accessed via a ref to keep it out
 *     of PanResponder/renderItem dependency chains
 */
export default function DraggableList({
    data,
    renderItem,
    keyExtractor,
    onDragEnd,
    onItemTap,
    contentContainerStyle,
    refreshControl,
    ...flatListProps
}) {
    const flatListRef = useRef(null);
    const currentData = useRef(data);
    currentData.current = data;

    // Controls RefreshControl's enabled prop. Setter via ref to avoid deps.
    const [refreshEnabled, setRefreshEnabled] = useState(true);
    const setRefreshRef = useRef(setRefreshEnabled);
    setRefreshRef.current = setRefreshEnabled;

    const itemLayouts = useRef({});
    const draggingIndexRef = useRef(null);
    const hoverIndexRef = useRef(null);

    // Per-item Animated.Values
    const itemAnims = useRef({});
    const getItemAnim = (index) => {
        if (!itemAnims.current[index]) {
            itemAnims.current[index] = {
                opacity: new Animated.Value(1),
                translateY: new Animated.Value(0),
                scale: new Animated.Value(1),
            };
        }
        return itemAnims.current[index];
    };

    const onItemLayout = useCallback((index, event) => {
        const { y, height } = event.nativeEvent.layout;
        itemLayouts.current[index] = { y, height };
    }, []);

    const calcHoverIndex = useCallback((fromIndex, dy) => {
        const itemHeight = itemLayouts.current[fromIndex]?.height || 100;
        const positionDelta = Math.round(dy / itemHeight);
        const newIndex = fromIndex + positionDelta;
        return Math.max(0, Math.min(currentData.current.length - 1, newIndex));
    }, []);

    const animateShifts = useCallback((fromIndex, toIndex) => {
        const draggedHeight = itemLayouts.current[fromIndex]?.height || 100;

        for (let i = 0; i < currentData.current.length; i++) {
            if (i === fromIndex) continue;
            const anim = getItemAnim(i);
            let targetY = 0;

            if (fromIndex < toIndex) {
                if (i > fromIndex && i <= toIndex) targetY = -draggedHeight;
            } else if (fromIndex > toIndex) {
                if (i >= toIndex && i < fromIndex) targetY = draggedHeight;
            }

            Animated.timing(anim.translateY, {
                toValue: targetY,
                duration: 200,
                useNativeDriver: false,
            }).start();
        }
    }, []);

    const resetAllShifts = useCallback(() => {
        for (const key in itemAnims.current) {
            const anim = itemAnims.current[key];
            anim.translateY.setValue(0);
            anim.opacity.setValue(1);
            anim.scale.setValue(1);
        }
    }, []);

    const handlersCache = useRef({});

    const createDragHandlers = useCallback((index) => {
        let timer = null;
        let active = false;
        let hasMoved = false;
        const dragOffset = new Animated.Value(0);

        const pr = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => active,
            onPanResponderTerminationRequest: () => false,

            onPanResponderGrant: () => {
                timer = setTimeout(() => {
                    active = true;
                    draggingIndexRef.current = index;
                    hoverIndexRef.current = index;
                    dragOffset.setValue(0);

                    // Disable RefreshControl (toggle enabled prop, not remove)
                    setRefreshRef.current(false);

                    const anim = getItemAnim(index);
                    anim.opacity.setValue(0.6);
                    anim.scale.setValue(1.03);

                    Vibration.vibrate(30);
                }, 250);
            },

            onPanResponderMove: (_, gesture) => {
                if (!active) {
                    if (Math.abs(gesture.dy) > 8 || Math.abs(gesture.dx) > 8) {
                        if (timer) { clearTimeout(timer); timer = null; }
                    }
                    return;
                }

                dragOffset.setValue(gesture.dy);

                if (Math.abs(gesture.dy) > 25) hasMoved = true;

                if (hasMoved) {
                    const newHover = calcHoverIndex(index, gesture.dy);
                    if (newHover !== hoverIndexRef.current) {
                        hoverIndexRef.current = newHover;
                        animateShifts(index, newHover);
                    }
                }
            },

            onPanResponderRelease: () => {
                if (timer) { clearTimeout(timer); timer = null; }

                if (!active) {
                    if (onItemTap) onItemTap(index);
                    return;
                }

                // Re-enable RefreshControl
                setRefreshRef.current(true);

                const from = draggingIndexRef.current;
                const to = hoverIndexRef.current;

                if (hasMoved && from !== null && to !== null && from !== to) {
                    // Reorder data with LayoutAnimation FIRST
                    const newData = [...currentData.current];
                    const [removed] = newData.splice(from, 1);
                    newData.splice(to, 0, removed);
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    if (onDragEnd) onDragEnd({ data: newData });

                    // Reset shifts AFTER data has updated so items
                    // transition smoothly from shifted → new positions
                    requestAnimationFrame(() => {
                        resetAllShifts();
                        dragOffset.setValue(0);
                    });
                } else {
                    resetAllShifts();
                    dragOffset.setValue(0);
                }

                draggingIndexRef.current = null;
                hoverIndexRef.current = null;
                active = false;
                hasMoved = false;
                handlersCache.current = {};
            },

            onPanResponderTerminate: () => {
                if (timer) { clearTimeout(timer); timer = null; }
                setRefreshRef.current(true);
                resetAllShifts();
                dragOffset.setValue(0);
                draggingIndexRef.current = null;
                hoverIndexRef.current = null;
                active = false;
                hasMoved = false;
            },
        });

        return { panHandlers: pr.panHandlers, dragOffset };
    }, [calcHoverIndex, onDragEnd, onItemTap, animateShifts, resetAllShifts]);

    const getDragHandlers = useCallback((index) => {
        if (!handlersCache.current[index]) {
            handlersCache.current[index] = createDragHandlers(index);
        }
        return handlersCache.current[index];
    }, [createDragHandlers]);

    const prevLen = useRef(data.length);
    if (data.length !== prevLen.current) {
        handlersCache.current = {};
        itemAnims.current = {};
        prevLen.current = data.length;
    }

    const wrappedRenderItem = useCallback(({ item, index }) => {
        const anim = getItemAnim(index);
        const { panHandlers, dragOffset } = getDragHandlers(index);
        const combinedTranslateY = Animated.add(anim.translateY, dragOffset);

        return (
            <View onLayout={(e) => onItemLayout(index, e)}>
                <Animated.View style={{
                    opacity: anim.opacity,
                    transform: [
                        { translateY: combinedTranslateY },
                        { scale: anim.scale },
                    ],
                }}>
                    {renderItem({
                        item,
                        index,
                        dragHandlers: panHandlers,
                        isActive: false,
                    })}
                </Animated.View>
            </View>
        );
    }, [renderItem, getDragHandlers, onItemLayout]);

    // Clone RefreshControl with toggled `enabled` prop
    const clonedRefreshControl = refreshControl
        ? React.cloneElement(refreshControl, { enabled: refreshEnabled })
        : undefined;

    return (
        <FlatList
            ref={flatListRef}
            data={data}
            renderItem={wrappedRenderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={contentContainerStyle}
            refreshControl={clonedRefreshControl}
            scrollEventThrottle={16}
            {...flatListProps}
        />
    );
}
