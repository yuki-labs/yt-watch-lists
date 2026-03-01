// Content script injected into YouTube pages to detect video end events.
// Communicates with background.js for playback queue coordination.
// Handles both regular videos (ended event) and Shorts (loop-restart detection).

(function () {
    'use strict';

    let isPlaybackTab = false;
    let currentVideoElement = null;
    let endedFiredForCurrentVideo = false;
    let wasNearEnd = false;

    // Check with background if this tab is the active playback tab
    async function checkPlaybackStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'IS_PLAYBACK_TAB' });
            isPlaybackTab = response && response.isPlaybackTab;
        } catch (e) {
            isPlaybackTab = false;
        }
        return isPlaybackTab;
    }

    function isShorts() {
        return window.location.pathname.startsWith('/shorts/');
    }

    // Attach the appropriate listener depending on video type
    function attachVideoEndListener() {
        const video = document.querySelector('video');
        if (!video || video === currentVideoElement) return;

        // Clean up previous listeners
        detachListeners();

        currentVideoElement = video;
        endedFiredForCurrentVideo = false;
        wasNearEnd = false;

        if (isShorts() || video.loop) {
            // Shorts (looping video): detect the loop restart.
            // Track when playback is near the end, then fire when it seeks back to ~0.
            video.addEventListener('timeupdate', onLoopTimeUpdate);
            video.addEventListener('seeked', onLoopSeeked);
        } else {
            // Regular video: use the standard ended event
            video.addEventListener('ended', onVideoEnded);
        }
    }

    function detachListeners() {
        if (currentVideoElement) {
            currentVideoElement.removeEventListener('ended', onVideoEnded);
            currentVideoElement.removeEventListener('timeupdate', onLoopTimeUpdate);
            currentVideoElement.removeEventListener('seeked', onLoopSeeked);
            currentVideoElement = null;
        }
        endedFiredForCurrentVideo = false;
        wasNearEnd = false;
    }

    // Track when playback reaches near the end
    function onLoopTimeUpdate() {
        const video = currentVideoElement;
        if (!video || video.duration <= 0) return;
        if (video.currentTime >= video.duration - 1) {
            wasNearEnd = true;
        }
    }

    // Detect the loop restart: seeked back to near 0 after being near the end
    function onLoopSeeked() {
        const video = currentVideoElement;
        if (!video || endedFiredForCurrentVideo) return;
        if (wasNearEnd && video.currentTime < 1) {
            // Loop just triggered — treat as "ended"
            endedFiredForCurrentVideo = true;
            onVideoEnded();
        }
    }

    async function onVideoEnded() {
        // Re-check in case status changed
        const active = await checkPlaybackStatus();
        if (!active) return;

        try {
            await chrome.runtime.sendMessage({ type: 'VIDEO_ENDED' });
        } catch (e) {
            // Extension context invalidated, ignore
        }
    }

    // YouTube is an SPA — re-attach listener on navigation
    function onYouTubeNavigate() {
        detachListeners();
        // Wait a moment for the new video element to mount
        setTimeout(() => {
            attachVideoEndListener();
        }, 1500);
    }

    // Observe for video element appearing (initial load or SPA nav)
    function waitForVideo() {
        const existing = document.querySelector('video');
        if (existing) {
            attachVideoEndListener();
            return;
        }

        const observer = new MutationObserver(() => {
            const video = document.querySelector('video');
            if (video) {
                observer.disconnect();
                attachVideoEndListener();
            }
        });
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // Initialize
    async function init() {
        const active = await checkPlaybackStatus();
        if (active) {
            waitForVideo();
        }

        // Listen for YouTube SPA navigations
        document.addEventListener('yt-navigate-finish', onYouTubeNavigate);

        // Also listen for messages from background (e.g. tab becomes active playback tab)
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'PLAYBACK_ACTIVATED') {
                isPlaybackTab = true;
                waitForVideo();
                sendResponse({ ok: true });
            } else if (message.type === 'PLAYBACK_DEACTIVATED') {
                isPlaybackTab = false;
                detachListeners();
                sendResponse({ ok: true });
            }
            return false;
        });
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
