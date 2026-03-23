# CrossdaleArts Website

This is the official website project for CrossdaleArts.

The project uses only:
- HTML
- CSS
- JavaScript
- A small Node.js server (`server.js`) for local running and feedback API

There is no framework and no build step.

## 1. Main Purpose

This website is used for:
- showing the artist profile
- showing course pages
- showing the gallery
- collecting feedback
- opening payment pages

## 2. Main Files

Project root:

- `index.html`: home page
- `style.css`: all website styles
- `script.js`: all website frontend logic
- `server.js`: local server and feedback API
- `README.md`: project guide

Data files:

- `data/gallery-media.json`: gallery categories, gallery items, category previews, homepage preview
- `data/feedbacks.json`: public feedback list

Pages folder:

- `pages/courses.html`: all courses list page
- `pages/my-story.html`: artist story page
- `pages/fundamental-of-arts.html`: course page
- `pages/the-art-of-meaning.html`: course page
- `pages/the-art-of-meaning-core.html`: course page
- `pages/*-payment.html`: payment pages

Media folders:

- `images/`: images used by the website
- `images/Gallery/`: gallery images
- `Videos/`: gallery videos

Extra folder:

- `DUMP/`: old files, not part of main project flow

## 3. How Pages Use Files

All main pages load:
- `style.css`
- `script.js`

That means:
- if you change `style.css`, many pages change
- if you change `script.js`, many pages change

## 4. How To Run The Project

### Option 1: Use Node server

Run:

```bash
node server.js
```

Then open:

```text
http://localhost:8000
```

### Option 2: Open HTML directly

You can open `index.html` directly in a browser, but some things work better with a server.

Recommended:
- use `node server.js`

## 5. Data Files You Will Edit Most

### `data/gallery-media.json`

This file controls:
- homepage gallery preview
- category cards preview
- category names
- image and video order inside each category

### `data/feedbacks.json`

This file stores public feedback entries.

## 6. Gallery JSON Structure

Current structure:

```json
{
  "homepage_preview": {
    "preview": {
      "path": "images/Gallery/gallery-image-23.JPEG",
      "title": "Painting",
      "type": "image"
    },
    "category": "Records"
  },
  "categories": [
    {
      "name": "Records",
      "preview": {
        "path": "images/Gallery/gallery-image-23.JPEG",
        "title": "Painting",
        "type": "image"
      },
      "items": [
        {
          "path": "images/Gallery/gallery-image-1.jpeg",
          "title": "National Spokesperson",
          "type": "image"
        }
      ]
    }
  ]
}
```

### Meaning of each field

`homepage_preview`: object
- controls the gallery preview shown on the home page

`homepage_preview.preview`: object
- separate preview media for homepage showcase

`homepage_preview.preview.path`: string
- file path of homepage preview image or video

`homepage_preview.preview.title`: string
- title for homepage preview media

`homepage_preview.preview.type`: string
- allowed values: `image` or `video`

`homepage_preview.category`: string
- fallback category name
- used only if `homepage_preview.preview` is missing or broken
- if fallback is used, the first item of that category becomes the homepage preview

`categories`: array
- list of gallery categories
- category order follows this array order exactly

`categories[].name`: string
- category name shown in gallery folder cards

`categories[].preview`: object
- separate preview media for category card

`categories[].preview.path`: string
- file path for category preview

`categories[].preview.title`: string
- title for category preview

`categories[].preview.type`: string
- allowed values: `image` or `video`

`categories[].items`: array
- list of gallery items inside that category
- item order follows this array order exactly

`categories[].items[].path`: string
- file path for image or video

`categories[].items[].title`: string
- visible title in gallery

`categories[].items[].type`: string
- allowed values: `image` or `video`

## 7. Gallery Order Rule

Important:

The website now follows your JSON order.

That means:
- if you move a category block up or down, category order changes
- if you move an item up or down inside `items`, gallery item order changes

No name-based sorting is used for gallery display order.

## 8. Homepage Preview Rule

Homepage gallery preview loads in this order:

1. `homepage_preview.preview`
2. first item from `homepage_preview.category`
3. first available item in gallery

## 9. Category Preview Rule

Category card preview loads in this order:

1. `categories[].preview`
2. first item in that category

## 10. Feedback Data Structure

A feedback item in `data/feedbacks.json` looks like this:

```json
{
  "name": "Farhin Kadodia",
  "rating": 5,
  "message": "Transparency and genuineness are rare these days..."
}
```

Field types:
- `name`: string
- `rating`: number
- `message`: string

## 11. `script.js` Overview

`script.js` handles:
- mobile navbar
- gallery
- gallery lightbox
- PDF viewer
- course image preview
- feedback widget
- feedback modal
- scroll reveal animation

## 12. `script.js` Main Constants And Types

### Global constants

- `VIDEO_EXTENSIONS`: `Set<string>`
  - video file extensions list

- `GALLERY_META_URL`: `string`
  - path to `data/gallery-media.json`

- `FEEDBACK_ROTATION_MS`: `number`
  - feedback auto-rotation delay

- `FEEDBACK_TRANSITION_MS`: `number`
  - feedback card transition timing

- `FEEDBACK_DATA_URL`: `string`
  - path to `data/feedbacks.json`

- `FEEDBACK_STORAGE_KEY`: `string`
  - browser localStorage key for feedback

- `FEEDBACK_SOCIAL_LINKS`: `Array<object>`
  - social links shown in feedback section

## 13. `script.js` Functions And What They Do

### Navbar

- `getFileExtension(path)`
  - returns file extension from a path
  - type: `string -> string`

### Gallery helper functions

- `getGalleryStemInfo(path)`
  - reads gallery filename pattern like `gallery-image-3.jpeg`
  - type: `string -> object|null`

- `getGalleryAssetKindFromPath(path)`
  - returns `image` or `video` from file name when possible
  - type: `string -> string`

- `getGalleryTitle(item)`
  - returns item title
  - uses explicit title first, then fallback title
  - type: `object -> string`

- `inferMediaType(item)`
  - decides if an item is image or video
  - type: `object -> string`

- `normalizeVideoSources(item)`
  - builds video source list
  - type: `object -> Array<object>`

- `buildGalleryItem(item)`
  - converts raw item into final gallery item object
  - type: `object -> object`

- `probeImageSource(src)`
  - checks if an image file exists and loads
  - type: `string -> Promise<boolean>`

- `probeVideoSource(src)`
  - checks if a video file exists and loads
  - type: `string -> Promise<boolean>`

- `loadGalleryConfig()`
  - reads `data/gallery-media.json`
  - normalizes category structure
  - supports old flat structure too
  - type: `() -> Promise<object>`

- `loadGalleryItems()`
  - validates gallery files
  - builds homepage preview
  - builds category previews
  - preserves JSON order
  - type: `() -> Promise<object>`

- `renderGalleryPreviewMedia(item)`
  - creates `img` or `video` element for preview
  - type: `object -> HTMLElement`

- `createGalleryBrowserModal()`
  - creates or returns the gallery browser modal
  - type: `() -> object`

- `initGalleryExperience()`
  - starts the gallery system
  - builds category view and item view
  - type: `() -> Promise<void>`

### Gallery lightbox

- `createGalleryLightbox()`
  - creates or returns the gallery lightbox modal
  - type: `() -> object`

### PDF viewer

- `createPdfViewerModal()`
  - creates or returns PDF modal
  - type: `() -> object`

- `extractGoogleDriveFileId(url)`
  - gets Drive file ID from URL
  - type: `string -> string`

- `buildGoogleDrivePreviewUrl(url)`
  - builds embeddable Google Drive preview URL
  - type: `string -> string`

- `initEmbeddedPdfViewer()`
  - enables PDF opening inside modal
  - type: `() -> void`

### Video fallback helpers

- `setVideoSources(videoEl, sources, onAllFailed)`
  - tries multiple video sources until one works
  - type: `(HTMLVideoElement, Array<object>, function) -> boolean`

- `showVideoFallback(container, item)`
  - shows fallback link if video cannot play
  - type: `(HTMLElement, object) -> void`

- `buildFallbackSources(src)`
  - creates possible alternate video paths
  - type: `string -> Array<string>`

- `prioritizeSources(sources)`
  - sorts video source order by preferred extension
  - type: `Array<object> -> Array<object>`

### Course image preview

- `setupCourseImagePreview()`
  - opens course images in lightbox-style modal
  - type: `() -> void`

### Feedback system

- `initFeedbackWidget()`
  - creates feedback widget on homepage
  - auto-rotates feedbacks
  - opens feedback modal and form
  - type: `() -> Promise<void>`

- `createFeedbackModal()`
  - creates feedback modal container
  - type: `() -> object`

- `openFeedbackDetailModal(detailModal, feedback)`
  - opens feedback detail view
  - type: `(object, object) -> void`

- `openFeedbackFormModal(detailModal, onSubmit)`
  - opens feedback form modal
  - type: `(object, function) -> void`

- `loadFeedbackList()`
  - loads feedback from JSON and browser localStorage
  - type: `() -> Promise<Array<object>>`

- `saveFeedbackEntry(entry)`
  - saves feedback to localStorage in browser
  - type: `object -> Promise<object>`

- `getLocalFeedbacks()`
  - reads feedback from localStorage
  - type: `() -> Array<object>`

- `sanitizeFeedback(raw)`
  - validates feedback data
  - type: `object -> object|null`

- `renderStars(rating)`
  - makes star string from rating
  - type: `number -> string`

- `truncateFeedback(text, maxLen)`
  - shortens long feedback message
  - type: `(string, number) -> string`

- `escapeHTML(text)`
  - escapes unsafe HTML characters
  - type: `string -> string`

### Scroll reveal

- `initScrollReveal()`
  - adds scroll-based reveal animation to sections
  - type: `() -> void`

## 14. `server.js` Overview

`server.js` is a small Node server.

It does 2 jobs:
- serve static files
- save and return feedback from `/api/feedbacks`

## 15. `server.js` Constants And Types

- `PORT`: `number|string`
  - server port

- `ROOT`: `string`
  - project root path

- `FEEDBACK_PATH`: `string`
  - full path of `data/feedbacks.json`

- `CONTENT_TYPES`: `object`
  - map of file extension to content type string

## 16. `server.js` Functions And What They Do

- `sendJson(res, statusCode, payload)`
  - sends JSON response
  - type: `(ServerResponse, number, object) -> void`

- `sanitizeFeedback(raw)`
  - validates feedback before saving on server
  - type: `object -> object|null`

- `readFeedbackList()`
  - reads all feedback from file
  - type: `() -> Promise<Array<object>>`

- `writeFeedbackList(list)`
  - writes all feedback into file
  - type: `Array<object> -> Promise<void>`

- `handleApi(req, res)`
  - handles `/api/feedbacks`
  - type: `(IncomingMessage, ServerResponse) -> Promise<boolean>`

- `resolvePublicPath(urlPath)`
  - safely maps URL path to local file path
  - type: `string -> string|null`

- `handleStatic(req, res)`
  - serves static file content
  - type: `(IncomingMessage, ServerResponse) -> Promise<void>`

## 17. CSS Overview

`style.css` contains all design styles for the whole website.

Main sections in CSS:
- root variables
- global reset
- navbar
- artist statement
- enrollment section
- feedback widget and modal
- about section
- expertise section
- gallery showcase
- gallery browser modal
- gallery lightbox
- PDF viewer
- exhibitions section
- recognitions section
- footer
- courses page
- story page
- course detail page
- responsive media queries

## 18. CSS Variables In `:root`

All CSS variables in `:root` are strings.

### Typography variables

- `--font-size-body`
- `--line-height-body`
- `--font-size-nav`
- `--font-size-nav-tablet`
- `--font-size-site-title`
- `--font-size-site-title-mobile`
- `--font-size-site-title-small`
- `--font-size-navbar-tagline`
- `--font-size-navbar-tagline-mobile`
- `--font-size-alert-banner`
- `--font-size-artist-statement`
- `--font-size-enrollment-button`
- `--font-size-enrollment-button-mobile`
- `--font-size-feedback-widget-title`
- `--font-size-feedback-count`
- `--font-size-feedback-stars`
- `--font-size-feedback-name`
- `--font-size-feedback-message`
- `--font-size-feedback-leave-button`
- `--font-size-feedback-social-label`
- `--font-size-feedback-modal-close`
- `--font-size-feedback-modal-stars`
- `--font-size-feedback-modal-name`
- `--font-size-feedback-modal-message`
- `--font-size-feedback-form-label`
- `--font-size-feedback-form-input`
- `--font-size-feedback-form-submit`
- `--font-size-feedback-form-note`
- `--font-size-about`
- `--font-size-art-expertise`
- `--font-size-gallery-eyebrow`
- `--font-size-gallery-title`
- `--font-size-gallery-title-mobile`
- `--font-size-gallery-text`
- `--font-size-gallery-text-mobile`
- `--font-size-gallery-count`
- `--font-size-gallery-action`
- `--font-size-gallery-browser-title`
- `--font-size-gallery-browser-count`
- `--font-size-gallery-lightbox-title`
- `--font-size-gallery-browser-button`
- `--font-size-gallery-browser-item-title`
- `--font-size-gallery-browser-item-title-mobile`
- `--font-size-gallery-browser-item-type`
- `--font-size-gallery-browser-item-type-mobile`
- `--font-size-pdf-title`
- `--font-size-pdf-title-mobile`
- `--font-size-pdf-button`
- `--font-size-exhibitions`
- `--font-size-recognitions`
- `--font-size-footer`
- `--font-size-footer-small`
- `--font-size-courses-page-title`
- `--font-size-courses-page-title-mobile`
- `--font-size-courses-page-subtitle`
- `--font-size-courses-page-subtitle-mobile`
- `--font-size-course-card-title`
- `--font-size-course-card-text`
- `--font-size-course-card-link`
- `--font-size-best-seller`
- `--font-size-story-eyebrow`
- `--font-size-story-hero-title`
- `--font-size-story-intro`
- `--font-size-story-body`
- `--font-size-story-body-mobile`
- `--font-size-story-section-title`
- `--font-size-story-section-title-mobile`
- `--font-size-story-quote`
- `--font-size-story-quote-mobile`
- `--font-size-story-button`
- `--font-size-course-content`
- `--font-size-course-enroll-button`
- `--font-size-course-enroll-button-mobile`
- `--font-size-download-button`
- `--font-size-download-button-mobile`
- `--font-size-bonus-button`

### Effect and motion variables

- `--surface-lift-shadow`
- `--surface-lift-shadow-strong`
- `--glass-hover-light`
- `--glass-hover-dark`
- `--glass-hover-edge-light`
- `--glass-hover-edge-dark`
- `--glass-hover-glow`
- `--hover-bump-distance`
- `--panel-open-duration`
- `--panel-open-ease`
- `--panel-offset-y`
- `--panel-scale`
- `--feedback-swap-duration`
- `--feedback-swap-ease`

## 19. Important CSS Selectors

Main selectors you may edit often:
- `nav`
- `#navbar`
- `#alert-banner`
- `#artist-statement`
- `#enrollment`
- `.feedback-widget`
- `.feedback-card`
- `#about-me`
- `#art-expertise`
- `#art-gallery`
- `.gallery-showcase`
- `.gallery-browser-modal`
- `.gallery-browser-grid`
- `.gallery-browser-card`
- `.gallery-lightbox`
- `.pdf-viewer-modal`
- `#exhibitions`
- `#recognitions`
- `footer`
- `#courses-page`
- `.course-card`
- `#story-page`
- `.story-card`
- `.story-section`
- `#course-content`

## 20. What To Edit For Common Tasks

### Change homepage gallery preview
Edit in `data/gallery-media.json`:
- `homepage_preview.preview.path`
- `homepage_preview.preview.title`
- `homepage_preview.preview.type`

### Change category card preview
Edit in `data/gallery-media.json`:
- `categories[].preview.path`
- `categories[].preview.title`
- `categories[].preview.type`

### Reorder items inside a category
Move entries inside:
- `categories[].items`

### Reorder categories
Move blocks inside:
- `categories`

### Add a new category
Add a new object inside:
- `categories`

### Add a new gallery item
Add a new object inside:
- `categories[].items`

### Change website text styles
Edit variables inside:
- `:root` in `style.css`

### Change feedback shown publicly
Edit:
- `data/feedbacks.json`

## 21. Things To Be Careful About

- Path must be correct
- Type must be `image` or `video`
- If file does not exist, it will be skipped
- `style.css` affects many pages at once
- `script.js` affects many pages at once
- Keep JSON valid, with commas and quotes correct

## 22. Recommended Workflow

When changing gallery:

1. open `data/gallery-media.json`
2. change preview if needed
3. move items up or down if you want new order
4. save file
5. refresh website

When changing styles:

1. open `style.css`
2. edit `:root` variables first
3. only edit selectors if variables are not enough
4. refresh website and check mobile too

## 23. Final Note

This project is simple on purpose.

Best files to manage day to day:
- `data/gallery-media.json`
- `data/feedbacks.json`
- `style.css`
- page HTML files

Best rule:
- use JSON for gallery content and order
- use CSS variables for design changes
- use HTML files for page text and layout
