# ACP Tribute Board - Development Todos

## Completed (Current Implementation)

### Technical Infrastructure
- [x] Set up project structure (React + TypeScript + Vite)
- [x] Configure routing with react-router-dom (createBrowserRouter)
- [x] Create baseline index.css and styling
- [x] Configure Firebase (env-based config: API key, Auth, RTDB, Storage, Firestore, Functions)
- [x] Implement authentication flow (email/password + Google OAuth, AuthContext, ProtectedRoute)
- [x] Connect to Firebase Realtime Database (Yjs provider for collaborative feed)
- [x] Configure Firebase Storage for file uploads (post images, artifact files)
- [x] Set up Firebase Hosting (GitHub Actions workflow for PR previews)
- [x] Configure Firestore (users collection, security rules) and Cloud Functions

### Dynamic Recognition Feed
- [x] Implement scrollable social feed component (Feed page, masonry grid, sliding window)
- [x] Add support for photo uploads and display (TipTap image upload, Storage)
- [x] Rich text posts with formatting, image upload, emoji (TipTap + Yjs collaboration)
- [x] Post creation with multimedia support (images; GIF supported via image upload)
- [x] Historical posts display (infinite scroll, post view modal)

### Admin & Access Control
- [x] Admin authentication and authorization (AdminRoute, `isHighLevel` custom claim)
- [x] Admin-only route and nav link (`/admin`, visible to Staff only)
- [x] Admin dashboard with user list (Firestore `users` collection)
- [x] Promote users to Staff via `assignHighLevel` Cloud Function

### Exhibit & Artifacts
- [x] Exhibit page with 8 themed parallax sections
- [x] Artifact system: video (YouTube embed), slideshow, document, gallery
- [x] Gallery artifacts: draggable/resizable arrangement (react-rnd), layout as JSON
- [x] Static exhibit slide images (webp from `public/exhibits/`)
- [x] Light/dark/auto theme toggle (Bootstrap 5.3, localStorage)

---

## Current / Near-Term

- [ ] **Exhibit #6 (Pandemic):** No slides yet; client may remove or add later

---

## Phase 2: Optional Enhancements (Feed & Social)

### Feed Extras
- [ ] Short video uploads and playback in posts (beyond YouTube embeds in artifacts)
- [ ] Group video support in feed (if desired)
- [ ] Explicit “GIF” post type or improved GIF handling in feed (images already support GIF MIME)

### Interactive Reactions
- [ ] Emoji-style reaction system (hearts, claps, etc.) on posts
- [ ] Reaction counter and display
- [ ] Comment thread system with replies
- [ ] Notifications for reactions and comments

### Content Moderation (Admin)
- [ ] Content moderation interface (delete inappropriate posts)
- [ ] Featured “Hero” post management

---

## Phase 3: Analytics & Compliance (Future)

### Engagement Analytics
- [ ] Real-time reporting (most recognized individuals, department activity)
- [ ] Company values demonstration tracking
- [ ] Analytics dashboard with charts

### Sentiment (Research)
- [ ] Research NLP/sentiment library; sentiment on recognition messages
- [ ] Sentiment dashboard and cultural-gap alerts

### Security & Launch
- [ ] Review ISO 27001 / SOC 2 or equivalent; data protection and encryption
- [ ] Privacy policy and terms of service
- [ ] Cross-browser and mobile testing; accessibility (WCAG); performance and security testing
- [ ] Launch kit: branded templates, video tutorials, communication plan, onboarding flow
