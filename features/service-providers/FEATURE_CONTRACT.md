# OLDX Service Providers — Agreed Feature Contract (Review Only)

This document records the approved product behavior for future implementation. It is not a deployed feature, Firestore schema, permission grant, or instruction to publish rules. Implement on the review branch first and preserve existing Products, Stores, Chat, and Admin behavior.

## Provider profile
- One provider profile may list multiple distinct services. Providers can add/remove services without creating duplicate profiles.
- Display name, profile photo, service categories, skills, years of experience, work description, portfolio photos, service area and optional radius.
- Optional indicative prices, languages spoken, availability and an active/inactive toggle.
- Make setup and edits straightforward on low-end Android devices and slower connections.
- Each provider has a stable, shareable profile URL; sharing should support a useful image preview, optional poster/card, copy-link and QR code.

## Buyer discovery and contact
- Prominent Services entry point on home/navigation.
- Search and filter by category, work type, town/city, nearby location (with permission), experience, rating, availability and optional price.
- Show service area clearly; do not present location precision or verified status unless independently established.
- Offer Call, WhatsApp and OLDX Message actions with existing sign-in, privacy and chat-safety rules respected.
- Keep the UI clear in Gujarati, Hindi and English, including language changes through settings.

## Reviews, trust and moderation
- Only a buyer linked to a qualifying enquiry or completed job may leave feedback.
- Limit to one review per qualifying enquiry/job; prevent self-reviews and duplicate submissions.
- Do not allow providers to edit buyer reviews; enable reporting, moderation and a transparent rating calculation.
- Avoid unearned verification badges. Protect phone numbers and location data according to explicit consent.
- Apply upload limits, abuse prevention and reporting to profile and portfolio media.

## Provider dashboard and rollout
1. Profile creation/editing, multi-service selection and portfolio.
2. Buyer discovery, provider details and contact.
3. Enquiry-linked reviews, reports and moderation.
4. Share card/QR, analytics and polish.
5. End-to-end mobile, accessibility, security and performance tests before launch.

## Engineering gates
- Build schema and strict server-side ownership validation before enabling writes.
- Test Firestore rules and cross-user access in an emulator before any staging publication.
- Never connect review-only helpers directly to production data.
- Avoid requiring paid Firebase Storage; determine an explicitly approved low-cost media path first.
- No production changes, deployment, billing, credentials or Firebase rules updates are authorized by this document.
