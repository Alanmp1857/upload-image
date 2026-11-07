# Image Upload

A small Express and EJS app for uploading images. It shows a local preview before upload and lets you reveal the uploaded image afterward.

## Requirements

- Node.js 20.9.0 or later
- npm

## Run locally

```bash
npm install
npm start
```

Open [http://localhost:8000](http://localhost:8000).

## Upload limits and validation

- Accepts JPEG, PNG, and WebP images only.
- Maximum file size: 5 MB.
- Maximum dimensions: 20 megapixels; animated or multi-frame images are rejected.
- Images are decoded and re-encoded before being saved with a generated filename in `uploads/`.
- The app does not perform antivirus scanning. Re-encoding helps reduce risk, but it does not guarantee that an image is free of malware.

Uploaded images are stored locally and are not intended to be committed to the repository.
