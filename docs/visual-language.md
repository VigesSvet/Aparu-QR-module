# APARU Visual Language

## Purpose
Фиксирует визуальный язык QR-сервиса заказа такси APARU и запрещает стилевой дрейф при дальнейшей разработке.

## Principles
- Light-first UI: base background `#F7F7F5`, main surfaces `#FFFFFF`, elevated soft surfaces `#FFF7ED`, accent `#FF8C00`, muted text `#71717A`.
- Mobile-first composition with a centered content column and `max-width: 480px`.
- Fast, obvious, low-friction booking flow; every screen should reduce user effort.
- No gradients and no decorative visual noise.
- Calm separation through spacing, borders, and soft shadows only where they help readability.
- High emphasis on primary CTA buttons; secondary actions should stay quieter but still readable on light surfaces.

## Components
- Buttons: full-width primary buttons, orange fill `#FF8C00`, dark text, radius `12px`, padding `16px`, strong weight.
- Inputs: white/light surfaces, clear borders, large tap targets, readable placeholders, visible focus state using accent color.
- Cards: white or soft warm-light surfaces, radius `16px`, subtle borders, restrained shadow.
- Status blocks: compact icon + title + explanatory text, clear active/completed differentiation, no overflow on mobile.
- Fare/payment/tariff selectors: stable card-based options that can stack on narrow screens without width jitter.
- Progress pills: responsive layout that wraps/reflows safely inside smartphone viewport.

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
- Do: preserve APARU simplicity, strong orange CTAs, restrained spacing, and stable mobile layouts.
- Do: prefer responsive stacking over squeezing wide controls into one row.
- Don't: reintroduce dark theme defaults, random accent colors, noisy gradients, or unstable card layouts.
- Don't: add decorative widgets that slow down the booking flow.
