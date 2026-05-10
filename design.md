# Flow Stack Studio — Design System

## Concept
Premium dark developer tool. Think VS Code + Postman Flows + linear.app. No gradients, no blobs, no startup noise. Structure, clarity, density.

## Color Palette
- Background: `#0a0a0b` (near-black)
- Surface 1: `#111113` (cards, panels)
- Surface 2: `#1a1a1e` (elevated cards, tabs)
- Surface 3: `#252529` (hover states, code bg)
- Border: `#2a2a2f` (subtle borders)
- Border Active: `#3d3d45`
- Text Primary: `#f0f0f2`
- Text Secondary: `#8b8b99`
- Text Muted: `#5a5a6a`
- Accent: `#6e56cf` (violet — primary accent)
- Accent Light: `#8b72e8`
- Accent Dim: `#6e56cf22`
- Green: `#22c55e` (confidence high)
- Amber: `#f59e0b` (confidence medium)
- Red: `#ef4444` (confidence low)
- Blue: `#3b82f6` (info/links)
- Cyan: `#06b6d4` (flow nodes)

## Typography
- Font: **JetBrains Mono** (headings, labels) + **Inter** (body, descriptions)
- Headline: 40–48px, weight 600, tight tracking
- Subheadline: 20–24px, weight 500
- Body: 14–15px, weight 400, 1.6 line-height
- Label/Badge: 11–12px, weight 600, uppercase, tracked wide
- Code: JetBrains Mono, 13px

## Layout
- Max width: 1280px centered
- Nav: sticky, 60px, transparent with border-bottom
- Sections: generous padding 80px vertical
- Cards: 1px border, subtle bg, 8–12px border-radius
- Grid: 12-column, with clear content hierarchy

## Motion
- Page enter: staggered fade+slide (0.2s base, 0.05s stagger)
- Tabs: instant switch with subtle content fade
- Loading steps: sequential text change with dot animation
- Node hover: scale 1.02, border color shift
- No bounces, no spring physics

## Component Style
- Buttons: solid accent or ghost, no rounded-full, medium font weight
- Badges: small, compact, colored background with matching text
- Inputs: dark bg, border focus glow in accent color
- Tabs: underline-style or pill-style, clear active state
- Cards: 1px border, bg surface-1, hover bg surface-2

## Anti-patterns
- No purple gradients on light bg
- No glowing blob backgrounds
- No generic card grid with heavy drop shadows
- No Inter as only font
- No cookie-cutter "SaaS landing page" layout
