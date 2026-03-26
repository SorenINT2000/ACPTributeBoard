# ACP Tribute Board

A tribute board web application for a California chapter ACP official stepping down from office after a decade of leadership. Built with React + TypeScript + Vite, backed by Firebase.

## High-Level Architecture

- **Framework:** React 18 + TypeScript, bundled with Vite
- **Backend:** Firebase (Firestore for posts/artifacts, Storage for uploads, Authentication for access control)
- **Rich Text Editing:** TipTap editor; posts persist only when the user clicks Save (no save-on-close)
- **Routing:** React Router v6 (browser router)
- **Styling:** Bootstrap 5.3 color modes (`data-bs-theme`) with CSS custom properties; light/dark/auto theme toggle

### Data Flow

```
User -> AuthContext (Firebase Auth) -> Page Component (Feed is public; Exhibit/Admin are protected)
Page Component -> usePostEditor hook -> postService -> Firestore
Feed Component -> postService -> Firestore (paginated fetch + IntersectionObserver infinite scroll + feed-refresh banner)
Uploads -> imageUpload utils -> Firebase Storage -> Public URLs
```

### ADR: Migrated Posts from Realtime Database to Firestore, Dropped Yjs Collaboration

Posts were previously stored in Firebase Realtime Database with Yjs CRDT-based live collaborative editing. This was replaced with a simpler Firestore-backed model because:
- Non-admin users can only edit their own posts, so live multi-user collaboration on a single document is unnecessary.
- RTDB's fan-out problem (O(N×M) bandwidth when N listeners each receive M updates) made burst scenarios (1,500 concurrent users) expensive and fragile.
- Maintaining two databases (RTDB for posts, Firestore for artifacts/profiles) added operational complexity.
- Firestore offers per-document read pricing, better querying (`orderBy`, `startAfter`), and predictable cost.

Posts use a simple TipTap editor. On the feed, **Create a Post** opens the editor with a client-generated id only; the Firestore document is created on the first **Save** (with the current HTML). Closing the modal without saving does not write to Firestore. Edits to existing posts also save only via **Save**; closing discards unsaved changes. A lightweight `onSnapshot` listener on the newest post document compares its id to the newest post the client has loaded; when they differ (e.g. someone posted, or the former top post was deleted), a "Feed may have changed" banner invites a manual refresh instead of auto-reloading the list.

## System Manifest

- **AuthContext / useAuth**: Handles Firebase authentication state, login, signup, logout. Supports email/password and Google OAuth (via `signInWithPopup`).
- **postService** (`src/hooks/postService.ts`): Firestore CRUD and query functions for posts — `createPost` (optional initial `content`), `updatePostContent`, `updatePostExhibit`, `deletePost`, `getPostsPaginated`, `getMorePosts`, `subscribeToPost`, `subscribeToNewestPost`, `subscribeToAllPosts`.
- **artifactService** (`src/hooks/artifactService.ts`): Firestore CRUD for artifacts — `subscribeToArtifacts`, `createArtifact`, `updateArtifact`, `deleteArtifact`.
- **usePostEditor** (`src/hooks/usePostEditor.ts`): Manages a TipTap editor. Loads existing post content from Firestore, or starts empty for `isUnsavedDraft` (feed create flow). **Save** either runs `createPost` with editor HTML (first save of a draft) or `updatePostContent`. Image uploads use the draft id under `post-images/{postId}/` even before the document exists. Supports optional `onDraftSaved` after the first create.
- **imageUpload utils**: Handles uploading post images and artifact files to Firebase Storage.
- **exhibitImages utils** (`src/utils/exhibitImages.ts`): Lists, uploads, and deletes images from `website-images/exhibits/exhibit-{N}/` in Firebase Storage for the exhibit header carousel. Exposes `getExhibitImages` (URL list), `getExhibitImageEntries` (name+URL pairs sorted by filename), `uploadExhibitImage`, and `deleteExhibitImage`.
- **CarouselEditorModal** (`src/components/CarouselEditorModal.tsx`): Admin-only modal for managing exhibit carousel images — view ordered file list with thumbnail tooltips on hover, upload new images, and delete existing ones. Order is determined by filename prefixes (`{NNN}-{timestamp}-{random}.{ext}`). No drag-and-drop reorder; admins control order via delete and re-upload.
- **GalleryArrangement** (`GalleryArrangement.tsx`): Arrangement box for gallery artifacts; images can be positioned and resized (aspect-ratio locked via react-rnd); content saved as JSON `{ images: [{ url, x, y, scale, aspect }] }` with relative values (0–1).
- **ArtifactModal** (`ArtifactModal.tsx`): Shared viewer shell using react-bootstrap **`Modal`** (`show` / `onHide` via `onClose`). Forwards common props (`size`, `centered`, `backdrop`, `keyboard`, `scrollable`, `fullscreen`, `dialogClassName`, `contentClassName`, `backdropClassName`, `container`, etc.). `variant="video"` drops the header for full-bleed embeds.
- **ArtifactSlideshow** (`ArtifactSlideshow.tsx`): Slideshow artifacts; users upload an ordered list of slide images. Content is stored only as JSON `{ slides: ["url1", "url2", ...] }`. Display card shows first slide with count badge. Modal opens a swipeable slide viewer with arrow/keyboard/touch navigation (`variant="video"` shell, no raw HTML embeds).
- **userProfile utils**: Manages user display names and profile data.
- **ThemeContext / useTheme**: Manages light/dark/auto theme preference. Persists to `localStorage`, sets `data-bs-theme` attribute on `<html>` so Bootstrap 5.3 color modes handle component styling natively. ADR: Switched from `@media (prefers-color-scheme)` CSS overrides to Bootstrap's `data-bs-theme` attribute to eliminate ~120 lines of manual Bootstrap dark mode overrides and enable a user-facing toggle.

## Pages

| Route | Component | Auth Required | Description |
|-------|-----------|---------------|-------------|
| `/` | `Feed` | No | Hero card, public feed, and onboarding copy: guests see a short “read without account” note; signed-in **non-staff** users see detailed “How to use this board” steps (save/cancel, edit/delete, exhibits, refresh banner); staff see only the compact hero + Create button |
| `/login` | `Login` | No | Firebase authentication login |
| `/signup` | `Signup` | No | New user registration |
| `/exhibit` | `Exhibit` | Yes | Curated, structured walkthrough of exhibits with parallax scroll |
| `/admin` | `Admin` | Yes (Staff only) | Admin dashboard: user list, promote to Staff via `assignHighLevel`; gated by `AdminRoute` |

## Exhibit Page Architecture

The Exhibit page uses a static `EXHIBITS` config array that defines 8 themed exhibits, each with:
- Parallax scroll header (sticky positioning with background image carousel, title, and quote)
- Dynamic artifacts (uploaded via the Artifact Editor)
- User-contributed posts (filtered by exhibit number)

### Exhibit Header Carousel

Each exhibit header supports an auto-rotating image carousel. Images are loaded from Firebase Storage at `website-images/exhibits/exhibit-{N}/` (e.g. `website-images/exhibits/exhibit-1/`). If no images are found in Storage, the static `backgroundImage` from the exhibit config is used as a fallback. The carousel uses Bootstrap's `Carousel` component with crossfade transitions, 8-second intervals, and no visible controls/indicators (clean background look).

**Filename convention:** Files are named `{NNN}-{timestamp}-{random}.{ext}` (e.g. `001-1740000000-abc123.jpg`). `listAll` results are sorted by filename, which gives the correct display order. Gaps from deletions are fine.

**Admin carousel editor:** High-level users see a pencil icon in the top-right corner of each parallax header. Clicking it opens the `CarouselEditorModal`, which shows an ordered list of files with thumbnail popover on hover, upload zone (drag-and-drop or click-to-browse), and per-item delete buttons. Changes apply immediately to Firebase Storage. Closing the modal triggers a reload of the parent carousel.

### Current Exhibits (as of Feb 2026)

| # | Title | Quote Author |
|---|-------|-------------|
| 1 | Physician Well-being and Professional Fulfillment | Amanda Gorman |
| 2 | Advocacy | Nancy Pelosi |
| 3 | Chapter Alignment, Sustainability, and Success | African Proverb |
| 4 | Medical Education and Evidence-based Medicine | George R. Minot |
| 5 | Creating a Professional Home | Verna Myers |
| 6 | Navigating the Pandemic | Melinda Gates |
| 7 | Leadership Development | Ross Simmonds |
| 8 | Legacy | Maya Angelou |

Static fallback images are in `public/exhibits/`: `bg-wellbeing.webp`, `bg-advocacy.webp`, `chapter.webp`, `bg-med-ed.webp`, `bg-professional-home.webp`, `bg-leaders.webp`, `bg-legacy.webp`. Exhibit 6 uses an external Unsplash URL. When carousel images exist in Firebase Storage (`website-images/exhibits/exhibit-{N}/`), they take precedence over the static fallback.

## Scene Bootstrapping

1. `main.tsx` renders `<App />`.
2. `App.tsx` wraps everything in `<ThemeProvider>` then `<AuthProvider>` and sets up the `BrowserRouter` with routes. `ThemeProvider` sets `data-bs-theme` on `<html>` and persists the user's preference to `localStorage`.
3. The feed (`/`) is publicly accessible. Protected routes (`/exhibit`) are wrapped in `<ProtectedRoute>`; `/admin` uses `<AdminRoute>` (requires `isHighLevel` claim).
4. `Layout` component provides the `<Navbar>` and `<Outlet>` structure.

## Firestore Security Rules

- **users/{userId}**: Authenticated users can read any profile; only the owning user can create/update their own profile.
- **posts/{postId}**: Anyone can read all posts (public feed). Authors can create posts and update their own (but cannot change `exhibit` assignment). Admins (`highLevel` claim) can update/delete any post.
- **artifacts/{artifactId}**: Authenticated users can read. Only `highLevel` users can create, update, or delete artifacts.

### Storage Rules

- **post-images/**: Public read; authenticated users can upload (max 10 MB, images only); Staff can delete.
- **website-images/**: Public read (hero image, site assets); only Staff can write.
- **artifacts/**: Public read; authenticated users can upload (max 50 MB); Staff can delete.

## Current State & Known Issues

### Implemented and Working
- Firebase Authentication (email/password + Google sign-in via popup) with protected routes for Exhibit/Admin
- Public social feed (viewable without login) with hero card, guest onboarding blurb, member-only detailed instructions for non-staff users, paginated loading, and optional "feed may have changed" refresh banner (driven by newest-post id mismatch)
- Rich text editor (TipTap) with formatting toolbar, image upload, emoji support, explicit Save only (no save-on-close)
- Exhibit page with 8 themed parallax sections
- Exhibit parallax headers with auto-rotating image carousels (sourced from Firebase Storage) with static fallback images
- Admin carousel editor modal for managing exhibit header images (upload, delete, filename-prefix ordering)
- Artifact system: upload/edit curated content (videos, slideshows, documents, galleries)
- Gallery artifacts: images in a draggable/resizable arrangement box (react-rnd); layout stored as JSON with relative coords (0–1)
- Slideshow artifacts: ordered image upload with drag-to-reorder editor; swipeable slide viewer modal (arrow keys, touch swipe, click navigation); JSON `slides` array only
- Light/dark/auto theme toggle in navbar (Bootstrap 5.3 color modes, localStorage persistence)
- Masonry grid layout for posts
- Post view modal for reading full posts
- Post authors can delete their own posts from the feed and exhibit views (trash icon on the card, with confirmation); Firestore rules also allow Staff to delete any post
- Admin dashboard (`/admin`): user list, promote members to Staff via `assignHighLevel` Cloud Function; nav link visible only to Staff

### Known Issues / Next Steps
- Pandemic exhibit (#6) uses an external image; client may change or remove it in the final version
- Existing data in RTDB is not migrated (fresh start); old RTDB rules locked down to deny all access
- Deleting a post does not remove any images from storage
