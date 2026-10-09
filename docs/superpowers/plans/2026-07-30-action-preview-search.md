# API Action Preview Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-part action-name search to the API action preview page so a matching result jumps directly to its swiper position.

**Architecture:** Keep the existing virtualized swiper and absolute exercise index. Filter search results from the already selected `visibleExercises`; clicking a result updates `currentIndex`, recalculates the three-slide window, and clears the search text. Switching parts clears search and resets the preview.

**Tech Stack:** UniApp Vue 3, native input/view components, Node.js tests.

---

### Task 1: Add regression coverage

**Files:** Modify `app-api/pages/preview/index.test.cjs`.

- [ ] Assert the preview source contains the search input, `searchResults`, `searchText`, and `jumpToExercise`.
- [ ] Run `node --test pages/preview/index.test.cjs` and confirm it fails because the search UI/state is absent.

### Task 2: Implement current-part search and jump

**Files:** Modify `app-api/pages/preview/index.vue`.

- [ ] Add a search input below the part tabs and a compact result list that shows matching exercise names and targets.
- [ ] Add `searchText` state and a `searchResults` computed property that searches only `visibleExercises` by `name_zh`, case-insensitively, capped at 30 results.
- [ ] Add `jumpToExercise(exercise)` to find the absolute index, update the virtual swiper window, and clear the search text.
- [ ] Clear search in `changePart()` and `resetPreview()`.
- [ ] Keep the existing three-slide virtualization and loading guard unchanged.
- [ ] Run `node --test pages/preview/index.test.cjs` and then `npm run test:data`.

### Task 3: Final verification

- [ ] Validate `pages.json`, run `git diff --check -- app-api`, and inspect the final status.
- [ ] Remove temporary staging files and report that HBuilderX must be restarted before manual verification.
