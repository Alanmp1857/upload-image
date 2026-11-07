const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = 8000;
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 20_000_000;
const IMAGE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    }
});

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req,res) => {
    const uploadedName = typeof req.query.uploaded === 'string' && IMAGE_NAME_PATTERN.test(req.query.uploaded)
        ? req.query.uploaded
        : null;
    const uploadedImage = uploadedName && fs.existsSync(path.join(UPLOAD_DIR, uploadedName))
        ? `/images/${uploadedName}`
        : null;

    return res.render("homepage", { uploadedImage, errorMessage: null });
});

app.post('/upload', upload.single('image'), async (req, res, next) => {
    if (!req.file) {
        return res.status(400).render("homepage", {
            uploadedImage: null,
            errorMessage: 'Choose an image to upload.'
        });
    }

    let image;
    try {
        image = sharp(req.file.buffer, {
            limitInputPixels: MAX_INPUT_PIXELS,
            failOn: 'error'
        });
        let metadata;
        try {
            metadata = await image.metadata();
        } catch {
            return res.status(400).render("homepage", {
                uploadedImage: null,
                errorMessage: 'Only valid JPEG, PNG, or WebP images are accepted.'
            });
        }

        if (
            !['jpeg', 'png', 'webp'].includes(metadata.format) ||
            !metadata.width ||
            !metadata.height ||
            metadata.width * metadata.height > MAX_INPUT_PIXELS ||
            (metadata.pages ?? 1) > 1
        ) {
            return res.status(400).render("homepage", {
                uploadedImage: null,
                errorMessage: 'Upload a single-frame image with a maximum of 20 megapixels.'
            });
        }

        const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
        const filename = `${crypto.randomUUID()}.${extension}`;
        let sanitizedImage;

        try {
            const encoder = metadata.format === 'jpeg'
                ? image.rotate().jpeg({ quality: 85 })
                : metadata.format === 'png'
                    ? image.rotate().png({ compressionLevel: 9 })
                    : image.rotate().webp({ quality: 85 });
            sanitizedImage = await encoder.toBuffer();
        } catch {
            return res.status(400).render("homepage", {
                uploadedImage: null,
                errorMessage: 'The image could not be safely processed. Please choose another image.'
            });
        }

        await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), sanitizedImage, { flag: 'wx' });
        return res.redirect(`/?uploaded=${encodeURIComponent(filename)}`);
    } catch (error) {
        return next(error);
    }
});

app.get('/images/:filename', (req, res, next) => {
    const { filename } = req.params;
    if (!IMAGE_NAME_PATTERN.test(filename)) {
        return res.sendStatus(404);
    }

    res.set({
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600'
    });
    return res.sendFile(path.join(UPLOAD_DIR, filename), (error) => {
        if (error) {
            return next(error);
        }
    });
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).render("homepage", {
            uploadedImage: null,
            errorMessage: 'The image must be 5 MB or smaller.'
        });
    }

    if (error instanceof multer.MulterError) {
        return res.status(400).render("homepage", {
            uploadedImage: null,
            errorMessage: 'The upload could not be processed. Please try again.'
        });
    }

    console.error(error);
    if (res.headersSent) {
        return next(error);
    }
    return res.status(500).render("homepage", {
        uploadedImage: null,
        errorMessage: 'Something went wrong while processing the upload.'
    });
});

app.listen(PORT, () => `Server running on port ${PORT}`);