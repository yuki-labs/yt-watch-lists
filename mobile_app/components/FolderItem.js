import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Linking, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { getColors, getNeuColors } from '../theme/m3Theme';
import MenuModal from './MenuModal';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FolderItem({ folder, onToggle, onChildMenu, theme, colorScheme, dragHandlers, isActive }) {
    const isNeumorphic = theme === 'neumorphic';
    const colors = getColors(colorScheme);
    const nc = getNeuColors(colorScheme);

    // Child menu state
    const [menuChild, setMenuChild] = useState(null);
    const [menuVisible, setMenuVisible] = useState(false);

    const handleToggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onToggle();
    };

    const handleChildOption = (action, video) => {
        setMenuVisible(false);
        setMenuChild(null);
        onChildMenu(action, video);
    };

    const collapsed = folder.collapsed !== false;
    const pillText = `${collapsed ? '▶' : '▼'} ${folder.children.length} video${folder.children.length !== 1 ? 's' : ''}`;

    // ─── Neumorphic layout ───
    if (isNeumorphic) {
        const neuCardShadow = [
            { offsetX: 9, offsetY: 9, blurRadius: 16, spreadDistance: 0, color: `${nc.shadowDark}0.6)` },
            { offsetX: -9, offsetY: -9, blurRadius: 16, spreadDistance: 0, color: `${nc.shadowLight}0.8)` },
        ];
        const neuThumbShadow = [
            { offsetX: 3, offsetY: 3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowDark}0.5)`, inset: true },
            { offsetX: -3, offsetY: -3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowLight}0.6)`, inset: true },
        ];
        const neuChildShadow = [
            { offsetX: 4, offsetY: 4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowDark}0.4)`, inset: true },
            { offsetX: -4, offsetY: -4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowLight}0.6)`, inset: true },
        ];

        return (
            <View style={[styles.neuCard, { backgroundColor: nc.base, boxShadow: neuCardShadow }]}>
                {/* Folder Header */}
                <TouchableOpacity
                    style={styles.cardInner}
                    onPress={handleToggle}
                    activeOpacity={0.85}
                >
                    {/* Thumbnail + Pill */}
                    <View style={styles.thumbWrap}>
                        <View style={[styles.neuThumbnailWrapper, { boxShadow: neuThumbShadow }]}>
                            <Image
                                source={{ uri: folder.thumbnail }}
                                style={styles.neuThumbnail}
                                resizeMode="cover"
                            />
                        </View>
                        <View style={[styles.pill, { backgroundColor: `${nc.shadowDark}0.12)` }]}>
                            <Text style={[styles.pillText, { color: nc.text }]}>{pillText}</Text>
                        </View>
                    </View>
                    <View style={styles.neuInfo}>
                        <Text style={[styles.neuTitle, { color: nc.text }]} numberOfLines={2}>{folder.title}</Text>
                    </View>
                    <View
                        style={styles.dragHandle}
                        {...(dragHandlers || {})}
                    />
                </TouchableOpacity>

                {/* Children (expanded) */}
                {!collapsed && (
                    <View style={[styles.childrenContainer, { backgroundColor: nc.surface || nc.base, boxShadow: neuChildShadow, borderRadius: 10 }]}>
                        {folder.children.map((child) => (
                            <TouchableOpacity
                                key={child.id}
                                style={styles.childItem}
                                onPress={() => Linking.openURL(child.url)}
                                activeOpacity={0.85}
                            >
                                <Image
                                    source={{ uri: child.thumbnail }}
                                    style={styles.childThumbnail}
                                    resizeMode="cover"
                                />
                                <View style={styles.childInfo}>
                                    <Text style={[styles.childTitle, { color: nc.text }]} numberOfLines={2}>{child.title}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.childMenuBtn}
                                    onPress={() => { setMenuChild(child); setMenuVisible(true); }}
                                >
                                    <Text style={[styles.menuIcon, { color: nc.text }]}>⋮</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <MenuModal
                    visible={menuVisible}
                    video={menuChild}
                    onClose={() => { setMenuVisible(false); setMenuChild(null); }}
                    onOption={handleChildOption}
                    theme={theme}
                    colorScheme={colorScheme}
                />
            </View>
        );
    }

    // ─── M3 Expressive layout ───
    return (
        <Surface style={[styles.m3Card, { backgroundColor: colors.surfaceContainerLow }]} elevation={1}>
            {/* Folder Header */}
            <TouchableOpacity
                style={styles.cardInner}
                onPress={handleToggle}
                activeOpacity={0.8}
            >
                {/* Thumbnail + Pill */}
                <View style={styles.m3ThumbWrap}>
                    <Image
                        source={{ uri: folder.thumbnail }}
                        style={styles.m3Thumbnail}
                        resizeMode="cover"
                    />
                    <View style={[styles.pill, { backgroundColor: colors.surfaceContainerHighest }]}>
                        <Text style={[styles.pillText, { color: colors.onSurfaceVariant }]}>{pillText}</Text>
                    </View>
                </View>
                <View style={styles.m3Info}>
                    <Text
                        variant="titleSmall"
                        style={[styles.m3Title, { color: colors.onSurface }]}
                        numberOfLines={2}
                    >
                        {folder.title}
                    </Text>
                </View>
                <View {...(dragHandlers || {})} style={styles.dragHandle} />
            </TouchableOpacity>

            {/* Children (expanded) */}
            {!collapsed && (
                <View style={[styles.m3ChildrenContainer, { backgroundColor: colors.surfaceContainer }]}>
                    {folder.children.map((child) => (
                        <TouchableOpacity
                            key={child.id}
                            style={styles.childItem}
                            onPress={() => Linking.openURL(child.url)}
                            activeOpacity={0.8}
                        >
                            <Image
                                source={{ uri: child.thumbnail }}
                                style={styles.childThumbnail}
                                resizeMode="cover"
                            />
                            <View style={styles.childInfo}>
                                <Text
                                    variant="bodyMedium"
                                    style={[styles.childTitle, { color: colors.onSurface }]}
                                    numberOfLines={2}
                                >
                                    {child.title}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.childMenuBtn}
                                onPress={() => { setMenuChild(child); setMenuVisible(true); }}
                            >
                                <Text style={[styles.menuIcon, { color: colors.onSurfaceVariant }]}>⋮</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <MenuModal
                visible={menuVisible}
                video={menuChild}
                onClose={() => { setMenuVisible(false); setMenuChild(null); }}
                onOption={handleChildOption}
                theme={theme}
                colorScheme={colorScheme}
            />
        </Surface>
    );
}

const styles = StyleSheet.create({
    // ── Shared ──
    cardInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuIcon: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    thumbWrap: {
        alignItems: 'center',
    },
    m3ThumbWrap: {
        alignItems: 'center',
    },
    pill: {
        marginTop: 4,
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 10,
        alignSelf: 'center',
    },
    pillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    dragHandle: {
        width: 24,
        height: 40,
    },
    childItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    childThumbnail: {
        width: 80,
        height: 45,
        borderRadius: 8,
    },
    childInfo: {
        flex: 1,
        paddingHorizontal: 10,
        justifyContent: 'center',
    },
    childTitle: {
        fontSize: 13,
        fontWeight: '500',
    },
    childMenuBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── M3 Expressive ──
    m3Card: {
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
    },
    m3Thumbnail: {
        width: 140,
        height: 80,
        borderTopLeftRadius: 20,
    },
    m3Info: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        justifyContent: 'center',
    },
    m3Title: {
        fontWeight: '600',
        marginBottom: 4,
    },
    m3ChildrenContainer: {
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingVertical: 4,
    },

    // ── Neumorphic ──
    neuCard: {
        borderRadius: 15,
        marginBottom: 24,
        padding: 14,
        overflow: 'visible',
    },
    neuThumbnailWrapper: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    neuThumbnail: {
        width: 140,
        height: 80,
        borderRadius: 10,
    },
    neuInfo: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        justifyContent: 'center',
    },
    neuTitle: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
        marginBottom: 4,
    },
    childrenContainer: {
        marginTop: 10,
        padding: 6,
        overflow: 'visible',
    },
});
