# ACP Tribute Board

A tribute board web application for a California chapter ACP official stepping down from office after a decade of leadership. Built with React + TypeScript + Vite, backed by Firebase.

## High-Level Architecture

- **Framework:** React 18 + TypeScript, bundled with Vite
- **Backend:** Firebase (Realtime Database for posts/artifacts, Storage for uploads, Authentication for access control)
- **Real-time Collaboration:** Yjs CRDT library with a custom Firebase Realtime Database provider (`YjsRealtimeDatabaseProvider`) for live collaborative editing
- **Rich Text Editing:** TipTap editor with collaborative cursors
- **Routing:** React Router v6 (browser router)
- **Styling:** Bootstrap 5.3 color modes (`data-bs-theme`) with CSS custom properties; light/dark/auto theme toggle

### Data Flow

```
User -> AuthContext (Firebase Auth) -> ProtectedRoute -> Page Component
Page Component -> useYjs hook -> YjsRealtimeDatabaseProvider -> Firebase Realtime Database
Uploads -> imageUpload utils -> Firebase Storage -> Public URLs
```

## System Manifest

- **AuthContext / useAuth**: Handles Firebase authentication state, login, signup, logout. Supports email/password and Google OAuth (via `signInWithPopup`). Configured by `authContextConfig.ts`.
- **YjsRealtimeDatabaseProvider**: Custom Yjs provider that syncs collaborative documents via Firebase Realtime Database. Used by `useYjs` hook.
- **useYjs**: Hook that creates/manages TipTap editors with Yjs collaboration support.
- **useSlidingWindow**: Hook for efficient rendering of large post lists.
- **imageUpload utils**: Handles uploading post images and artifact files to Firebase Storage.
- **GalleryArrangement** (`GalleryArrangement.tsx`): Arrangement box for gallery artifacts; images can be positioned and resized (aspect-ratio locked via react-rnd); content saved as JSON `{ images: [{ url, x, y, scale, aspect }] }` with relative values (0–1).
- **ArtifactSlideshow** (`ArtifactSlideshow.tsx`): Slideshow artifacts; users upload an ordered list of slide images. Content stored as JSON `{ slides: ["url1", "url2", ...] }`. Display card shows first slide with count badge. Modal opens a swipeable slide viewer with arrow/keyboard/touch navigation. Legacy HTML content (Google Slides iframes, PDF embeds) falls back to `dangerouslySetInnerHTML` rendering. ADR: Chose image-upload-first approach over server-side PDF/PPTX conversion to keep the stack simple; server-side conversion can be added later as a Cloud Function without changing the content format.
- **userProfile utils**: Manages user display names and profile data.
- **ThemeContext / useTheme**: Manages light/dark/auto theme preference. Persists to `localStorage`, sets `data-bs-theme` attribute on `<html>` so Bootstrap 5.3 color modes handle component styling natively. ADR: Switched from `@media (prefers-color-scheme)` CSS overrides to Bootstrap's `data-bs-theme` attribute to eliminate ~120 lines of manual Bootstrap dark mode overrides and enable a user-facing toggle.

## Pages

| Route | Component | Auth Required | Description |
|-------|-----------|---------------|-------------|
| `/` | `Home` | No | Landing page |
| `/login` | `Login` | No | Firebase authentication login |
| `/signup` | `Signup` | No | New user registration |
| `/feed` | `Feed` | Yes | Real-time collaborative social media feed (Yjs-powered) |
| `/exhibit` | `Exhibit` | Yes | Curated, structured walkthrough of exhibits with parallax scroll |
| `/admin` | `Admin` | Yes (Staff only) | Admin dashboard: user list, promote to Staff via `assignHighLevel`; gated by `AdminRoute` |

## Exhibit Page Architecture

The Exhibit page uses a static `EXHIBITS` config array that defines 8 themed exhibits, each with:
- Parallax scroll header (sticky positioning with background image, title, and quote)
- Dynamic artifacts (uploaded via the Artifact Editor)
- User-contributed posts (filtered by exhibit number)

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

Background images used by exhibits are in `public/exhibits/`: `bg-wellbeing.webp`, `bg-advocacy.webp`, `chapter.webp`, `bg-med-ed.webp`, `bg-professional-home.webp`, `bg-leaders.webp`, `bg-legacy.webp`. Exhibit 6 uses an external Unsplash URL.

## Scene Bootstrapping

1. `main.tsx` renders `<App />`.
2. `App.tsx` wraps everything in `<ThemeProvider>` then `<AuthProvider>` and sets up the `BrowserRouter` with routes. `ThemeProvider` sets `data-bs-theme` on `<html>` and persists the user's preference to `localStorage`.
3. Protected routes (`/feed`, `/exhibit`) are wrapped in `<ProtectedRoute>`; `/admin` uses `<AdminRoute>` (requires `isHighLevel` claim).
4. `Layout` component provides the `<Navbar>` and `<Outlet>` structure.

## Current State & Known Issues

### Implemented and Working
- Firebase Authentication (email/password + Google sign-in via popup) with protected routes
- Real-time collaborative feed page with Yjs + Firebase RTDB
- Rich text editor (TipTap) with formatting toolbar, image upload, emoji support
- Exhibit page with 8 themed parallax sections
- Exhibit parallax headers with background images (webp in `public/exhibits/` or external URL)
- Artifact system: upload/edit curated content (videos, slideshows, documents, galleries)
- Gallery artifacts: images in a draggable/resizable arrangement box (react-rnd); layout stored as JSON with relative coords (0–1)
- Slideshow artifacts: ordered image upload with drag-to-reorder editor; swipeable slide viewer modal (arrow keys, touch swipe, click navigation); backward-compatible with legacy iframe embeds
- Light/dark/auto theme toggle in navbar (Bootstrap 5.3 color modes, localStorage persistence)
- Masonry grid layout for posts
- Post view modal for reading full posts
- Admin dashboard (`/admin`): user list, promote members to Staff via `assignHighLevel` Cloud Function; nav link visible only to Staff

### Known Issues / Next Steps
- Pandemic exhibit (#6) uses an external image; client may change or remove it in the final version
