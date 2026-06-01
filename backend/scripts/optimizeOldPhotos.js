const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ATTACHMENTS_DIR = path.join(__dirname, "../uploads/order_attachments");

async function optimizePhotos() {
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    console.log("No attachments directory found.");
    return;
  }

  const files = fs.readdirSync(ATTACHMENTS_DIR);
  const originalFiles = files.filter(f => !f.startsWith("thumb_") && /\.(jpg|jpeg|png|webp)$/i.test(f));

  console.log(`Found ${originalFiles.length} original photos to check.`);

  let optimizedCount = 0;
  let thumbCount = 0;

  for (const file of originalFiles) {
    const originalPath = path.join(ATTACHMENTS_DIR, file);
    const thumbPath = path.join(ATTACHMENTS_DIR, `thumb_${file}`);

    try {
      // 1. Generate thumbnail if it does not exist
      if (!fs.existsSync(thumbPath)) {
        await sharp(originalPath)
          .resize(250, 250, { fit: "cover" })
          .jpeg({ quality: 70 })
          .toFile(thumbPath);
        thumbCount++;
        console.log(`Created thumbnail for ${file}`);
      }

      // 2. Optimize original file if it is larger than 1MB
      const stats = fs.statSync(originalPath);
      if (stats.size > 1024 * 1024) { // > 1MB
        const tempPath = path.join(ATTACHMENTS_DIR, `temp_${file}`);
        await sharp(originalPath)
          .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(tempPath);
        
        fs.unlinkSync(originalPath); // remove original
        fs.renameSync(tempPath, originalPath); // rename temp to original
        optimizedCount++;
        console.log(`Optimized original ${file} (was ${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }

  console.log("--- Done ---");
  console.log(`Thumbnails created: ${thumbCount}`);
  console.log(`Originals optimized: ${optimizedCount}`);
}

optimizePhotos();
