const fs = require('fs');
const https = require('https');
const path = require('path');

// Helper function for downloading thumbnails
function processThumbnails(videos, thumbnailsDir) {
    if (!fs.existsSync(thumbnailsDir)) return;

    for (const video of videos) {
        const thumbPath = path.join(thumbnailsDir, `${video.id}.jpg`);
        if (!fs.existsSync(thumbPath)) {
            try {
                const url = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
                // Download in background, don't await the entire batch blocking
                https.get(url, (res) => {
                    if (res.statusCode === 200) {
                        const file = fs.createWriteStream(thumbPath);
                        res.pipe(file);
                        file.on('finish', () => file.close());
                    }
                }).on('error', (err) => {
                    fs.unlink(thumbPath, () => { });
                });
            } catch (err) {
                console.error(`Failed to initiate download for ${video.id}:`, err);
            }
        }
    }
}

module.exports = { processThumbnails };
