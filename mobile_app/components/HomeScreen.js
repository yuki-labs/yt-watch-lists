import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Alert,
    TextInput,
} from 'react-native';
import { fetchVideos, syncVideos, checkStatus, addVideo, deleteVideo, getLocalVideos, getLocalTimestamp } from '../api';
import VideoItem from './VideoItem';
import MenuModal from './MenuModal';
import EditTitleModal from './EditTitleModal';
import AddVideoModal from './AddVideoModal';

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

export default function HomeScreen({ onSettings, theme }) {
    const [videos, setVideos] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [editTitleVisible, setEditTitleVisible] = useState(false);
    const [addModalVisible, setAddModalVisible] = useState(false);

    // Progressive loading
    const PAGE_SIZE = 20;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Polling ref
    const pollIntervalRef = useRef(null);

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
                // Also sync videos when online
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
            // FAST: Load local data first for instant display
            const localVids = await getLocalVideos();
            if (localVids.length > 0) {
                setVideos(localVids);
            }

            // BACKGROUND: Fetch from server (may update the list)
            const status = await checkStatus();
            setIsOffline(!status);

            if (status) {
                const serverVids = await fetchVideos();
                setVideos(serverVids);
            }
        } catch (e) {
            console.log('Load error:', e);
            setIsOffline(true);
            // Still try to show local data on error
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

    // Progressive loading - only show visibleCount items
    const displayedVideos = filteredVideos.slice(0, visibleCount);
    const hasMore = visibleCount < filteredVideos.length;

    // Load more when reaching end of list
    const loadMore = useCallback(() => {
        if (hasMore) {
            setVisibleCount(prev => prev + PAGE_SIZE);
        }
    }, [hasMore]);

    // Reset visible count when search or videos change
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [searchQuery, videos.length]);

    // Handler for adding a video
    const handleAddVideo = async (url) => {
        const videoId = extractVideoId(url);
        if (!videoId) {
            Alert.alert('Invalid URL', 'Please enter a valid YouTube URL');
            return;
        }

        // Check if already exists
        if (videos.some(v => v.id === videoId)) {
            Alert.alert('Already Added', 'This video is already in your list');
            return;
        }

        try {
            // Fetch video info
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

    // Handler for menu options
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
        }
    };

    const syncAndUpdate = async (newVideos) => {
        setVideos(newVideos);
        await syncVideos(newVideos);
    };

    // Handler for editing title
    const handleEditTitle = async (videoId, newTitle) => {
        const newVideos = videos.map(v =>
            v.id === videoId ? { ...v, title: newTitle } : v
        );
        await syncAndUpdate(newVideos);
    };

    const isNeumorphic = theme === 'neumorphic';

    return (
        <View style={[styles.container, isNeumorphic && styles.neuContainer]}>
            <View style={[styles.header, isNeumorphic && styles.neuHeader]}>
                <Text style={[styles.headerTitle, isNeumorphic && styles.neuText]}>Watch Later {isOffline ? '(Offline)' : ''}</Text>
                <TouchableOpacity onPress={onSettings}>
                    <Text style={styles.settingsBtn}>⚙️</Text>
                </TouchableOpacity>
            </View>

            {isOffline && (
                <View style={styles.offlineBanner}>
                    <Text style={styles.offlineText}>No connection. Changes saved locally.</Text>
                </View>
            )}

            <View style={[styles.searchContainer, isNeumorphic && styles.neuHeader]}>
                <TextInput
                    style={[styles.searchInput, isNeumorphic && styles.neuInput]}
                    placeholder="Search videos..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                    placeholderTextColor={isNeumorphic ? '#999' : '#ccc'}
                />
            </View>

            <FlatList
                data={displayedVideos}
                renderItem={({ item }) => (
                    <VideoItem
                        item={item}
                        theme={theme}
                        onMenu={(v) => {
                            setSelectedVideo(v);
                            setMenuVisible(true);
                        }}
                    />
                )}
                keyExtractor={item => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={styles.list}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setAddModalVisible(true)}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            <AddVideoModal
                visible={addModalVisible}
                onClose={() => setAddModalVisible(false)}
                onAdd={handleAddVideo}
            />

            <MenuModal
                visible={menuVisible}
                video={selectedVideo}
                onClose={() => setMenuVisible(false)}
                onOption={handleMenuOption}
            />

            <EditTitleModal
                visible={editTitleVisible}
                video={selectedVideo}
                onClose={() => setEditTitleVisible(false)}
                onSave={handleEditTitle}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 15,
        paddingTop: 50,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    settingsBtn: {
        fontSize: 24,
    },
    offlineBanner: {
        backgroundColor: '#ffcc00',
        padding: 8,
        alignItems: 'center',
    },
    offlineText: {
        color: '#333',
        fontWeight: 'bold',
        fontSize: 12,
    },
    searchContainer: {
        padding: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    searchInput: {
        backgroundColor: '#f0f0f0',
        padding: 10,
        borderRadius: 8,
        fontSize: 16,
    },
    list: {
        padding: 10,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        backgroundColor: '#007bff',
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    fabText: {
        color: '#fff',
        fontSize: 30,
        marginTop: -4,
    },
    neuContainer: {
        backgroundColor: '#e0e5ec',
    },
    neuHeader: {
        backgroundColor: '#e0e5ec',
        borderBottomColor: 'rgba(163,177,198, 0.2)',
    },
    neuText: {
        color: '#4a4a4a',
    },
    neuInput: {
        backgroundColor: '#e0e5ec',
        borderRadius: 50,
        paddingHorizontal: 20,
        shadowColor: "#a3b1c6",
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 2,
    }
});
