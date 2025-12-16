const { ipcRenderer } = window.require('electron');

export async function saveVideos(videos) {
    return await ipcRenderer.invoke('save-videos', videos);
}

export async function selectFile() {
    return await ipcRenderer.invoke('select-file');
}

export function onSyncUpdate(callback) {
    ipcRenderer.on('sync-update', (event, videos) => callback(videos));
}

export function onConfigLoaded(callback) {
    ipcRenderer.on('config-loaded', (event, path) => callback(path));
}

export async function downloadThumbnails(videos) {
    return await ipcRenderer.invoke('download-thumbnails', videos);
}

export async function getLists() {
    return await ipcRenderer.invoke('get-lists');
}

export async function createList(filename) {
    return await ipcRenderer.invoke('create-list', filename);
}
export async function switchList(filename) {
    return await ipcRenderer.invoke('switch-list', filename);
}

export async function moveVideo(videoId, targetFilename) {
    return await ipcRenderer.invoke('move-video', { videoId, targetFilename });
}

export async function renameList(oldFilename, newFilename) {
    return await ipcRenderer.invoke('rename-list', { oldFilename, newFilename });
}

export async function getDeletedVideos() {
    return await ipcRenderer.invoke('get-deleted-videos');
}

export function onDeletedVideosUpdate(callback) {
    ipcRenderer.on('deleted-videos-update', (event, deletedVideos) => callback(deletedVideos));
}

export async function addTombstone(videoId) {
    return await ipcRenderer.invoke('add-tombstone', videoId);
}
