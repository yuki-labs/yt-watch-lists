export function parseVideoUrl(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        if (url.includes('youtube.com/watch')) {
            return urlObj.searchParams.get('v');
        } else if (url.includes('youtube.com/shorts/')) {
            return urlObj.pathname.split('/shorts/')[1];
        }
    } catch (e) {
        return null;
    }
    return null;
}

export async function fetchVideoTitle(videoId) {
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (response.ok) {
            const data = await response.json();
            return data.title;
        }
    } catch (error) {
        console.error("Failed to fetch video title:", error);
    }
    return `Video ${videoId}`;
}
