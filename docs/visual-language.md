# APARU Visual Language

## Purpose
Фиксирует визуальный язык QR-сервиса заказа такси APARU и запрещает стилевой дрейф при дальнейшей разработке.

## Principles
- Dark-first UI with premium taxi-service contrast: base background `#0D0D0D`, accent `#FFD700`, muted text `#A0A0A0`, surfaces `#1A1A1A`.
- Mobile-first composition with a centered content column and `max-width: 480px`.
- Fast, obvious, low-friction booking flow; every screen should reduce user effort.
- Smooth, quiet motion only; no decorative animation noise.
- High emphasis on primary CTA buttons; secondary actions should stay visually quieter.

## Components
- Buttons: full-width primary buttons, yellow fill `#FFD700`, black text, radius `12px`, padding `16px`, strong weight.
- Inputs: dark surfaces, clear contrast, large tap targets, readable placeholders, visible focus state using accent color.
- Cards: background `#1A1A1A`, radius `16px`, soft borders/shadows only if they improve separation.
- Status blocks: compact icon + title + explanatory text, clear active/completed differentiation.
- Fare/payment selectors: card-based options with strong selected state using accent border/fill cues.

## Interaction rules
- Loading states: calm skeletons/spinners, no jitter.
- Error states: explicit, compact, actionable; keep tone clear and direct.
- Empty states: explain what to do next in one short sentence.
- Success feedback: short confirmation, then immediate guided transition to the next step.

## Copy rules
- Tone: direct, reassuring, concise.
- Button labels: action-first (`Заказать`, `Получить код`, `Подтвердить заказ`).
- Validation wording: plain and specific; tell the user what to fix immediately.

## Do / Don't
- Do: preserve APARU dark theme, strong yellow CTAs, roomy mobile spacing, and a premium but restrained look.
- Don't: introduce random accent colors, oversized desktop layouts, noisy gradients, or decorative widgets that slow down the booking flow.
