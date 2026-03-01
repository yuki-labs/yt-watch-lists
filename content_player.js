// Content script injected into YouTube pages to detect video end events.
// Communicates with background.js for playback queue coordination.

(function () {
    'use strict';

    let isPlaybackTab = false;
    let videoEndHandlerAttached = false;
    let currentVideoElement = null;

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

    // Attach ended listener to the video element
    function attachVideoEndListener() {
        const video = document.querySelector('video');
        if (!video || video === currentVideoElement) return;

        // Remove old listener if switching elements
        if (currentVideoElement) {
            currentVideoElement.removeEventListener('ended', onVideoEnded);
        }

        currentVideoElement = video;
        videoEndHandlerAttached = true;
        video.addEventListener('ended', onVideoEnded);
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
        videoEndHandlerAttached = false;
        currentVideoElement = null;
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
                if (currentVideoElement) {
                    currentVideoElement.removeEventListener('ended', onVideoEnded);
                    currentVideoElement = null;
                }
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
