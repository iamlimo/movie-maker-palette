# TODO - Maintenance landing page

- [ ] Add `src/pages/Maintenance.tsx`
  - Minimal smooth under-maintenance UI
  - Animated visuals (CSS/Tailwind transitions) to feel engaging for an OTT/VOD streaming platform
  - Live countdown to **June 14th** (next upcoming date) with days/hours/minutes/seconds
  - Prominent “Contact us” mailto link to `support@signaturepicture.co`

- [ ] Update `src/App.tsx`
  - Route `/` should render `<Maintenance />` instead of `<Index />`
  - Keep other routes unchanged

- [ ] Quick local verification
  - Visit `/` and confirm maintenance page renders
  - Confirm counter counts down correctly
  - Confirm contact email link works
