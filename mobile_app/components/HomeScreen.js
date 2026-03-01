import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    StyleSheet,
    RefreshControl,
    Alert,
    Animated,
    Keyboard,
    Pressable,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import {
    Appbar,
    Searchbar,
    FAB,
    Banner,
    Text,
    IconButton,
    Icon,
} from 'react-native-paper';
import DraggableList from './DraggableList';
import { fetchVideos, syncVideos, checkStatus, addVideo, deleteVideo, getLocalVideos } from '../api';
import VideoItem from './VideoItem';
import MenuModal from './MenuModal';
import EditTitleModal from './EditTitleModal';
import AddVideoModal from './AddVideoModal';
import FolderItem from './FolderItem';
import { getColors, getNeuColors, getNeuShadows } from '../theme/m3Theme';

// ── CrossFadeIcon: fades between icons when the name changes ──
function CrossFadeIcon({ name, size, color }) {
    const [currentIcon, setCurrentIcon] = useState(name);
    const [prevIcon, setPrevIcon] = useState(name);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (name !== currentIcon) {
            setPrevIcon(currentIcon);
            fadeAnim.setValue(0);
            setCurrentIcon(name);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [name]);

    const fadeOut = fadeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
    });

    return (
        <View style={{ width: size, height: size }}>
            {prevIcon !== currentIcon && (
                <Animated.View style={{ position: 'absolute', opacity: fadeOut }}>
                    <Icon source={prevIcon} size={size} color={color} />
                </Animated.View>
            )}
            <Animated.View style={{ opacity: fadeAnim }}>
                <Icon source={currentIcon} size={size} color={color} />
            </Animated.View>
        </View>
    );
}

// Helper to extract video ID from YouTube URLs
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export default function HomeScreen({ onSettings, theme, colorScheme, onToggleColorScheme }) {
    const [videos, setVideos] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [editTitleVisible, setEditTitleVisible] = useState(false);
    const [addModalVisible, setAddModalVisible] = useState(false);

    // Polling ref
    const pollIntervalRef = useRef(null);

    // Dynamic colors
    const colors = getColors(colorScheme);
    const nc = getNeuColors(colorScheme);
    const neuShadows = getNeuShadows(colorScheme);
    const darkModeIcon = colorScheme === 'dark' ? 'weather-sunny' : 'weather-night';

    // Initial load
    useEffect(() => {
        loadVideos();
        startPolling();
        return () => stopPolling();
    }, []);

    const startPolling = () => {
        pollIntervalRef.current = setInterval(async () => {
            const status = await checkStatus();
            if (status) {
                setIsOffline(false);
                try {
                    const vids = await fetchVideos();
                    setVideos(vids);
                } catch (e) {
                    console.log('Polling fetch failed:', e);
                }
            } else {
                setIsOffline(true);
            }
        }, 6000);
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
    };

    const loadVideos = async () => {
        try {
            const localVids = await getLocalVideos();
            if (localVids.length > 0) {
                setVideos(localVids);
            }

            const status = await checkStatus();
            setIsOffline(!status);

            if (status) {
                const serverVids = await fetchVideos();
                setVideos(serverVids);
            }
        } catch (e) {
            console.log('Load error:', e);
            setIsOffline(true);
            const localVids = await getLocalVideos();
            if (localVids.length > 0) {
                setVideos(localVids);
            }
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadVideos();
        setRefreshing(false);
    }, []);

    // Filter videos by search
    const filteredVideos = videos.filter(v =>
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.id.includes(searchQuery)
    );

    const isSearching = searchQuery.length > 0;

    const handleDragEnd = useCallback(async ({ data }) => {
        if (isSearching) return;
        await syncAndUpdate(data);
    }, [isSearching, videos]);

    const handleAddVideo = async (url) => {
        const videoId = extractVideoId(url);
        if (!videoId) {
            Alert.alert('Invalid URL', 'Please enter a valid YouTube URL');
            return;
        }

        if (videos.some(v => v.id === videoId)) {
            Alert.alert('Already Added', 'This video is already in your list');
            return;
        }

        try {
            const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            const data = await response.json();

            const newVideo = {
                id: videoId,
                title: data.title || 'Unknown Title',
                url: `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            };

            const updatedVideos = await addVideo(newVideo);
            setVideos(updatedVideos);
        } catch (e) {
            Alert.alert('Error', 'Failed to add video');
            console.error(e);
        }
    };

    const handleMenuOption = async (action, video) => {
        const index = videos.findIndex(v => v.id === video.id);
        if (index === -1) return;

        let newVideos = [...videos];

        switch (action) {
            case 'edit':
                setEditTitleVisible(true);
                break;
            case 'delete':
                const updatedVideos = await deleteVideo(video.id);
                setVideos(updatedVideos);
                break;
            case 'top':
                newVideos.splice(index, 1);
                newVideos.unshift(video);
                await syncAndUpdate(newVideos);
                break;
            case 'bottom':
                newVideos.splice(index, 1);
                newVideos.push(video);
                await syncAndUpdate(newVideos);
                break;
            case 'up':
                if (index > 0) {
                    [newVideos[index], newVideos[index - 1]] = [newVideos[index - 1], newVideos[index]];
                    await syncAndUpdate(newVideos);
                }
                break;
            case 'down':
                if (index < newVideos.length - 1) {
                    [newVideos[index], newVideos[index + 1]] = [newVideos[index + 1], newVideos[index]];
                    await syncAndUpdate(newVideos);
                }
                break;
            case 'folder': {
                const folder = {
                    type: 'folder',
                    id: 'folder_' + Date.now(),
                    title: '📁 ' + video.title,
                    thumbnail: video.thumbnail,
                    children: [video],
                    collapsed: true,
                };
                newVideos.splice(index, 1, folder);
                await syncAndUpdate(newVideos);
                break;
            }
        }
    };

    const syncAndUpdate = async (newVideos) => {
        setVideos(newVideos);
        await syncVideos(newVideos);
    };

    const toggleFolder = useCallback((folderId) => {
        setVideos(prev => prev.map(item =>
            item.type === 'folder' && item.id === folderId
                ? { ...item, collapsed: !item.collapsed }
                : item
        ));
    }, []);

    const handleFolderChildMenu = async (action, childVideo, folderId) => {
        const folderIndex = videos.findIndex(v => v.id === folderId);
        if (folderIndex === -1) return;
        const folder = videos[folderIndex];
        const childIndex = folder.children.findIndex(v => v.id === childVideo.id);
        if (childIndex === -1) return;

        let newChildren = [...folder.children];
        let newVideos = [...videos];

        switch (action) {
            case 'edit':
                setSelectedVideo(childVideo);
                setEditTitleVisible(true);
                return;
            case 'delete':
                newChildren.splice(childIndex, 1);
                break;
            case 'top':
                newChildren.splice(childIndex, 1);
                newChildren.unshift(childVideo);
                break;
            case 'bottom':
                newChildren.splice(childIndex, 1);
                newChildren.push(childVideo);
                break;
            case 'up':
                if (childIndex > 0) {
                    [newChildren[childIndex], newChildren[childIndex - 1]] = [newChildren[childIndex - 1], newChildren[childIndex]];
                }
                break;
            case 'down':
                if (childIndex < newChildren.length - 1) {
                    [newChildren[childIndex], newChildren[childIndex + 1]] = [newChildren[childIndex + 1], newChildren[childIndex]];
                }
                break;
            default:
                return;
        }

        // If folder is now empty, remove it
        if (newChildren.length === 0) {
            newVideos.splice(folderIndex, 1);
        } else {
            newVideos[folderIndex] = { ...folder, children: newChildren };
        }
        await syncAndUpdate(newVideos);
    };

    const handleEditTitle = async (videoId, newTitle) => {
        // Check if editing a child inside a folder
        const newVideos = videos.map(item => {
            if (item.type === 'folder') {
                const childIdx = item.children.findIndex(c => c.id === videoId);
                if (childIdx !== -1) {
                    const newChildren = [...item.children];
                    newChildren[childIdx] = { ...newChildren[childIdx], title: newTitle };
                    return { ...item, children: newChildren };
                }
            }
            return item.id === videoId ? { ...item, title: newTitle } : item;
        });
        await syncAndUpdate(newVideos);
    };

    const isNeumorphic = theme === 'neumorphic';

    // Shared modal/list rendering helpers
    const renderVideoItem = useCallback(({ item, dragHandlers, isActive }) => {
        if (item.type === 'folder') {
            return (
                <FolderItem
                    folder={item}
                    theme={theme}
                    colorScheme={colorScheme}
                    isActive={isActive}
                    dragHandlers={isSearching ? undefined : dragHandlers}
                    onToggle={() => toggleFolder(item.id)}
                    onChildMenu={(action, childVideo) => handleFolderChildMenu(action, childVideo, item.id)}
                    onRename={(f) => { setSelectedVideo(f); setEditTitleVisible(true); }}
                />
            );
        }
        return (
            <VideoItem
                item={item}
                theme={theme}
                colorScheme={colorScheme}
                isActive={isActive}
                dragHandlers={isSearching ? undefined : dragHandlers}
                onMenu={(v) => {
                    setSelectedVideo(v);
                    setMenuVisible(true);
                }}
            />
        );
    }, [theme, colorScheme, isSearching, toggleFolder]);

    const handleItemTap = useCallback((index) => {
        const v = isSearching ? filteredVideos[index] : videos[index];
        if (v) { setSelectedVideo(v); setMenuVisible(true); }
    }, [isSearching, filteredVideos, videos]);

    const modals = (
        <>
            <AddVideoModal
                visible={addModalVisible}
                onClose={() => setAddModalVisible(false)}
                onAdd={handleAddVideo}
                theme={theme}
                colorScheme={colorScheme}
            />
            <MenuModal
                visible={menuVisible}
                video={selectedVideo}
                onClose={() => setMenuVisible(false)}
                onOption={handleMenuOption}
                theme={theme}
                colorScheme={colorScheme}
            />
            <EditTitleModal
                visible={editTitleVisible}
                video={selectedVideo}
                onClose={() => setEditTitleVisible(false)}
                onSave={handleEditTitle}
                theme={theme}
                colorScheme={colorScheme}
            />
        </>
    );

    const listData = isSearching ? filteredVideos : videos;

    // ─── Neumorphic layout ───
    if (isNeumorphic) {
        const settingsBtnShadow = [
            { offsetX: 4, offsetY: 4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowDark}0.5)` },
            { offsetX: -4, offsetY: -4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowLight}0.7)` },
        ];
        const searchInsetShadow = [
            { offsetX: 6, offsetY: 6, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowDark}0.5)`, inset: true },
            { offsetX: -6, offsetY: -6, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowLight}0.7)`, inset: true },
        ];
        const listContainerShadow = [
            { offsetX: 0, offsetY: 6, blurRadius: 12, spreadDistance: 0, color: `${nc.shadowDark}0.55)`, inset: true },
            { offsetX: 0, offsetY: -6, blurRadius: 12, spreadDistance: 0, color: `${nc.shadowLight}0.7)`, inset: true },
        ];
        const offlineBannerShadow = [
            { offsetX: 3, offsetY: 3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowDark}0.5)`, inset: true },
            { offsetX: -3, offsetY: -3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowLight}0.6)`, inset: true },
        ];

        return (
            <View style={[styles.container, { backgroundColor: nc.base }]}>
                <View style={[styles.neuHeader, { backgroundColor: nc.base }]}>
                    <View style={[styles.neuSearchWrapper, {
                        backgroundColor: nc.searchBg,
                        boxShadow: searchInsetShadow,
                    }]}>
                        <TextInput
                            style={[styles.neuSearchInput, { color: nc.text }]}
                            placeholder="Search videos..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                            placeholderTextColor={nc.placeholderText}
                        />
                    </View>
                </View>
                <Pressable onPress={Keyboard.dismiss} style={[styles.neuTitleRow, { backgroundColor: nc.base }]}>
                    <Text style={[styles.neuTitleText, { color: nc.text }]}>
                        Watch Later {isOffline ? '(Offline)' : ''}
                    </Text>
                    <View style={styles.neuButtonGroup}>
                        <IconButton
                            icon={() => <CrossFadeIcon name={darkModeIcon} size={22} color={nc.text} />}
                            onPress={onToggleColorScheme}
                            containerColor={nc.base}
                            rippleColor="transparent"
                            size={22}
                            style={[styles.neuSettingsBtn, { boxShadow: settingsBtnShadow }]}
                        />
                        <IconButton
                            icon="cog"
                            onPress={onSettings}
                            iconColor={nc.text}
                            containerColor={nc.base}
                            size={22}
                            style={[styles.neuSettingsBtn, { boxShadow: settingsBtnShadow }]}
                        />
                    </View>
                </Pressable>

                {isOffline && (
                    <View style={[styles.neuOfflineBanner, {
                        backgroundColor: nc.base,
                        boxShadow: offlineBannerShadow,
                    }]}>
                        <Text style={[styles.neuOfflineText, { color: nc.warning }]}>
                            No connection. Changes saved locally.
                        </Text>
                    </View>
                )}

                <View style={[styles.neuListContainer, {
                    backgroundColor: nc.surface,
                    boxShadow: listContainerShadow,
                }]}>
                    <DraggableList
                        data={listData}
                        renderItem={renderVideoItem}
                        keyExtractor={item => item.id}
                        onDragEnd={handleDragEnd}
                        onItemTap={handleItemTap}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        contentContainerStyle={styles.neuListContent}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.neuFab, {
                        backgroundColor: nc.base,
                        boxShadow: neuShadows.fabShadow,
                    }]}
                    onPress={() => setAddModalVisible(true)}
                >
                    <Text style={[styles.neuFabText, { color: nc.text }]}>+</Text>
                </TouchableOpacity>

                {modals}
            </View>
        );
    }

    // ─── M3 Expressive layout ───
    return (
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <Pressable onPress={Keyboard.dismiss}>
                <Appbar.Header
                    style={{ backgroundColor: colors.surfaceContainerLow }}
                    elevated
                >
                    <Appbar.Content
                        title="Watch Later"
                        subtitle={isOffline ? 'Offline' : undefined}
                        titleStyle={[styles.m3AppbarTitle, { color: colors.onSurface }]}
                    />
                    <Appbar.Action
                        icon={darkModeIcon}
                        onPress={onToggleColorScheme}
                        iconColor={colors.onSurface}
                    />
                    <Appbar.Action icon="cog" onPress={onSettings} iconColor={colors.onSurface} />
                </Appbar.Header>
            </Pressable>

            {isOffline && (
                <Banner
                    visible={true}
                    icon="wifi-off"
                    style={{ backgroundColor: colors.tertiaryContainer }}
                >
                    No connection — changes saved locally.
                </Banner>
            )}

            <View style={[styles.m3SearchContainer, { backgroundColor: colors.surface }]}>
                <Searchbar
                    placeholder="Search videos..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={[styles.m3Searchbar, { backgroundColor: colors.surfaceContainerHigh }]}
                    inputStyle={[styles.m3SearchInput, { color: colors.onSurface }]}
                    iconColor={colors.onSurfaceVariant}
                    placeholderTextColor={colors.onSurfaceVariant}
                    elevation={0}
                />
            </View>

            <DraggableList
                data={listData}
                renderItem={renderVideoItem}
                keyExtractor={item => item.id}
                onDragEnd={handleDragEnd}
                onItemTap={handleItemTap}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        progressBackgroundColor={colors.surfaceContainerHigh}
                    />
                }
                contentContainerStyle={styles.m3ListContent}
            />

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: colors.primaryContainer }]}
                color={colors.onPrimaryContainer}
                onPress={() => setAddModalVisible(true)}
            />

            {modals}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // ── M3 Expressive ──
    m3AppbarTitle: {
        fontWeight: '700',
        fontSize: 22,
    },
    m3SearchContainer: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 2,
    },
    m3Searchbar: {
        borderRadius: 28,
        elevation: 0,
    },
    m3SearchInput: {
        fontSize: 16,
    },
    m3ListContent: {
        paddingHorizontal: 12,
        paddingTop: 4,
        paddingBottom: 88,
    },
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 24,
        borderRadius: 28,
    },

    // ── Neumorphic ──
    neuHeader: {
        paddingHorizontal: 15,
        paddingTop: 50,
        paddingBottom: 10,
    },
    neuTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 10,
    },
    neuTitleText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    neuButtonGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    neuSettingsBtn: {
        borderRadius: 22,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    neuListContainer: {
        flex: 1,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    neuListContent: {
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: 88,
    },
    neuSearchWrapper: {
        borderRadius: 50,
        overflow: 'hidden',
    },
    neuSearchInput: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        fontSize: 16,
    },
    neuOfflineBanner: {
        padding: 10,
        alignItems: 'center',
        marginHorizontal: 15,
        marginBottom: 8,
        borderRadius: 12,
    },
    neuOfflineText: {
        fontWeight: '700',
        fontSize: 12,
    },
    neuFab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    neuFabText: {
        fontSize: 30,
        fontWeight: '600',
        marginTop: -2,
    },
});
