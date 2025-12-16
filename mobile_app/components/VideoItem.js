import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';

export default function VideoItem({ item, onMenu, theme }) {
    const isNeumorphic = theme === 'neumorphic';

    return (
        <TouchableOpacity
            style={[styles.item, isNeumorphic && styles.neuItem]}
            onPress={() => Linking.openURL(item.url)}
            onLongPress={() => onMenu(item)} // Keep long press as alternative
        >
            <Image
                source={{ uri: item.thumbnail }}
                style={[styles.thumbnail, isNeumorphic && styles.neuThumbnail]}
                resizeMode="cover"
            />
            <View style={styles.info}>
                <Text style={[styles.title, isNeumorphic && styles.neuText]} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.url} numberOfLines={1}>{item.url}</Text>
            </View>
            <TouchableOpacity
                style={[styles.menuBtn, isNeumorphic && styles.neuMenuBtn]}
                onPress={() => onMenu(item)}
            >
                <Text style={[styles.menuText, isNeumorphic && styles.neuText]}>⋮</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    item: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginBottom: 10,
        borderRadius: 8,
        overflow: 'hidden',
        elevation: 2,
    },
    thumbnail: {
        width: 160,
        height: 90,
    },
    info: {
        flex: 1,
        padding: 10,
        justifyContent: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    url: {
        fontSize: 12,
        color: '#888',
    },
    menuBtn: {
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuText: {
        fontSize: 24,
        color: '#666',
        fontWeight: 'bold',
    },
    neuItem: {
        backgroundColor: '#e0e5ec',
        borderRadius: 15,
        borderWidth: 0,
        elevation: 0, // Reset default elevation
        shadowColor: "#a3b1c6",
        shadowOffset: { width: 9, height: 9 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        // We can't easily do two shadows in React Native, so we prioritize the dark one for depth
        // Or wrap in another view to fake it, but simple shadow is often enough for "soft" look on mobile
        marginBottom: 20,
    },
    neuThumbnail: {
        borderRadius: 10,
    },
    neuText: {
        color: '#4a4a4a',
    },
    neuMenuBtn: {
        backgroundColor: '#e0e5ec',
        borderRadius: 20,
        margin: 5,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#a3b1c6",
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
    }
});
