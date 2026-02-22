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
- **GalleryArrangement** (`GalleryArrangement.tsx`): Arrangement box for gallery artifacts; images can be positioned and resized (aspect-ratio locked via react-rnd); content saved as JSON `{ images: [{ url, x, y, width, height }] }` with relative values (0–1).
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

## Exhibit Page Architecture

The Exhibit page uses a static `EXHIBITS` config array that defines 8 themed exhibits, each with:
- Parallax scroll header (sticky positioning with background image, title, and quote)
- Static slide images from `public/exhibits/` (presentation slides provided by client)
- Dynamic artifacts (uploaded via the Artifact Editor)
- User-contributed posts (filtered by exhibit number)

### Current Exhibits (as of Feb 2026)

| # | Title | Quote Author | Slides |
|---|-------|-------------|--------|
| 1 | Physician Well-being and Professional Fulfillment | Amanda Gorman | wellbeing-1, wellbeing-2 |
| 2 | Advocacy | Nancy Pelosi | advocacy-1, advocacy-2 |
| 3 | Chapter Alignment, Sustainability, and Success | African Proverb | chapters-1, chapters-2 |
| 4 | Medical Education and Evidence-based Medicine | George R. Minot | med-ed-1, med-ed-2 |
| 5 | Creating a Professional Home | Verna Myers | professional-home-1, professional-home-2 |
| 6 | Navigating the Pandemic | Melinda Gates | *(no slides yet; may be removed in final)* |
| 7 | Leadership Development | Ross Simmonds | leaders-1, leaders-2 |
| 8 | Legacy | Maya Angelou | legacy (placeholder) |

Slide images are stored in `public/exhibits/` as `.webp` files and referenced statically in the `EXHIBITS` config.

## Scene Bootstrapping

1. `main.tsx` renders `<App />`.
2. `App.tsx` wraps everything in `<ThemeProvider>` then `<AuthProvider>` and sets up the `BrowserRouter` with routes. `ThemeProvider` sets `data-bs-theme` on `<html>` and persists the user's preference to `localStorage`.
3. Protected routes (`/feed`, `/exhibit`) are wrapped in `<ProtectedRoute>` which checks `AuthContext`.
4. `Layout` component provides the `<Navbar>` and `<Outlet>` structure.

## Current State & Known Issues

### Implemented and Working
- Firebase Authentication (email/password + Google sign-in via popup) with protected routes
- Real-time collaborative feed page with Yjs + Firebase RTDB
- Rich text editor (TipTap) with formatting toolbar, image upload, emoji support
- Exhibit page with 8 themed parallax sections
- Static exhibit slide images (webp) rendered within each exhibit
- Artifact system: upload/edit curated content (videos, slideshows, documents, galleries)
- Gallery artifacts: images in a draggable/resizable arrangement box (react-rnd); layout stored as JSON with relative coords (0–1)
- Light/dark/auto theme toggle in navbar (Bootstrap 5.3 color modes, localStorage persistence)
- Masonry grid layout for posts
- Post view modal for reading full posts

### Known Issues / Next Steps
- Pandemic exhibit (#6) has no slides yet; client may remove it in the final version
- Legacy exhibit (#8) has only one placeholder slide; client is still completing Legacy slides
- `temp/` folder contains original TIFF source files and can be cleaned up
- `Contact.webp` slide in `public/exhibits/` is available but not yet assigned to an exhibit
