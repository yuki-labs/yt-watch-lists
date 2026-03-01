import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { getColors, getNeuColors } from '../theme/m3Theme';

export default function VideoItem({ item, onMenu, theme, colorScheme, dragHandlers, isActive }) {
    const isNeumorphic = theme === 'neumorphic';
    const colors = getColors(colorScheme);
    const nc = getNeuColors(colorScheme);

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
        const neuMenuBtnShadow = [
            { offsetX: 4, offsetY: 4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowDark}0.5)` },
            { offsetX: -4, offsetY: -4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowLight}0.7)` },
        ];

        return (
            <View style={[styles.neuCard, { backgroundColor: nc.base, boxShadow: neuCardShadow }]}>
                <TouchableOpacity
                    style={styles.cardInner}
                    onPress={() => Linking.openURL(item.url)}
                    activeOpacity={0.85}
                >
                    <View style={[styles.neuThumbnailWrapper, { boxShadow: neuThumbShadow }]}>
                        <Image
                            source={{ uri: item.thumbnail }}
                            style={styles.neuThumbnail}
                            resizeMode="cover"
                        />
                    </View>
                    <View style={styles.neuInfo}>
                        <Text style={[styles.neuTitle, { color: nc.text }]} numberOfLines={2}>{item.title}</Text>
                        <Text style={[styles.neuUrl, { color: nc.textSecondary }]} numberOfLines={1}>{item.url}</Text>
                    </View>
                </TouchableOpacity>
                <View
                    style={[styles.neuMenuBtn, { backgroundColor: nc.base, boxShadow: neuMenuBtnShadow }]}
                    {...(dragHandlers || {})}
                >
                    <Text style={[styles.menuIcon, { color: nc.text }]}>⋮</Text>
                </View>
            </View>
        );
    }

    // ─── M3 Expressive layout ───
    return (
        <Surface style={[styles.m3Card, { backgroundColor: colors.surfaceContainerLow }]} elevation={1}>
            <TouchableOpacity
                style={styles.cardInner}
                onPress={() => Linking.openURL(item.url)}
                activeOpacity={0.8}
            >
                <Image
                    source={{ uri: item.thumbnail }}
                    style={styles.m3Thumbnail}
                    resizeMode="cover"
                />
                <View style={styles.m3Info}>
                    <Text
                        variant="titleSmall"
                        style={[styles.m3Title, { color: colors.onSurface }]}
                        numberOfLines={2}
                    >
                        {item.title}
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={{ color: colors.onSurfaceVariant }}
                        numberOfLines={1}
                    >
                        {item.url}
                    </Text>
                </View>
                <View {...(dragHandlers || {})} style={styles.m3MenuBtn}>
                    <Text style={[styles.menuIcon, { color: colors.onSurfaceVariant }]}>⋮</Text>
                </View>
            </TouchableOpacity>
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
        borderBottomLeftRadius: 20,
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
    m3MenuBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Neumorphic ──
    neuCard: {
        borderRadius: 15,
        marginBottom: 24,
        padding: 14,
        overflow: 'visible',
        flexDirection: 'row',
        alignItems: 'center',
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
    neuUrl: {
        fontSize: 11,
        lineHeight: 15,
    },
    neuMenuBtn: {
        borderRadius: 20,
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
