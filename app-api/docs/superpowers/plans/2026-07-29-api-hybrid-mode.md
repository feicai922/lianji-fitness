# API Hybrid Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the API app's Chinese exercise metadata and instructions bundled locally while loading tutorial GIFs over the network.

**Architecture:** `data/clean_fitness_zh.js` remains the offline metadata source. `utils/media.js` exposes remote GIF URLs only, and the detail page keeps a text-step fallback when the network image fails. Generated local GIF copies are excluded from the API app's runtime and package.

**Tech Stack:** UniApp Vue3, ES modules, Node.js built-in test runner, remote HTTPS media URLs.

---

### Task 1: Lock the hybrid media contract

**Files:**
- Modify: `utils/media.test.cjs`

- [ ] Add a regression assertion that valid exercises return the remote GIF URL only and incomplete records return no URL.
- [ ] Run `npm run test:data` and confirm the existing local-first expectation fails before implementation.

### Task 2: Route tutorial media to the network

**Files:**
- Modify: `utils/media.js`
- Modify: `pages/detail/index.vue`
- Modify: `README.md`

- [ ] Return the HTTPS ExerciseDB GIF URL from `getExerciseGifSources` without a `/static/gifs` source.
- [ ] Keep the detail page's error state and Chinese instructions visible when the remote GIF fails.
- [ ] Document that metadata and Chinese instructions are local while GIFs require network access.

### Task 3: Remove generated GIF payload from the API variant

**Files:**
- Delete: `static/gifs/` generated GIF copies

- [ ] Confirm the API variant has no runtime reference to `/static/gifs/`.
- [ ] Remove only the generated GIF directory from the API variant; leave the original dataset and the local-storage app unchanged.

### Task 4: Verify the API variant

- [ ] Run `npm run test:data`.
- [ ] Run `node --check scripts/clean_exercises.cjs` and `node --check utils/media.js`.
- [ ] Confirm `data/clean_fitness_zh.js` still contains 826 local Chinese records and no API variant GIF directory remains.

