# Project Roadmap

> Last updated: August 2025

## 1 — OCR Accuracy & Spelling ✅
- [x] Evaluate newer Tesseract traineddata (best, fast, plus) and multilingual packs.
- [x] Experiment with adaptive image-preprocessing (contrast, threshold, deskew).
- [x] Implement robust spell-correction pipeline (custom dictionary, language-model fallback).

## 2 — Field Extraction Re-work ✅
- [x] Reliably detect **Store Name** and **Unit Number** (bounding-box size + regex).
- [x] Deprecate Phone, Website, Opening Hours fields.

## 3 — Address Lookup ✅
- [x] Call OneMap Geocoding API with captured lat/lng.
- [x] Store formatted postal address in each scan record.
- [x] Handle API failures gracefully (rate-limit, no-match ⇒ "Not Found").

## 4 — UI + CSV Schema ✅
- [x] Remove dropped columns; add **Address** column.
- [x] Split **Address** into separate **House/Block**, **Street**, **Building**, **Postcode** columns.
- [x] Update export logic and table rendering.

## 5 — Bug Sweep & Performance
- [x] Provide an option to delete unused / dirty data rows.
- [ ] Ensure camera resumes after dialogs on all iOS/Android versions.
- [ ] Review location permission edge cases.
- [ ] Consider storage caps / purge strategy for very large tables.

## 6 — UI Feedback
- [ ] Display image-processing status overlay on the camera preview with a determinate progress bar.

## 7 — Quality-of-life
- [ ] Misc UI polish (keyboard shortcuts, remember last export filename, dark-mode improvements).
- [ ] Code cleanup & modularisation (partial migration to ES modules).


---
Tick off each task (✓) as it’s completed. Feel free to append new items as requirements evolve. 