Found while testing E03-08 (#32) against real Google tiles; fixed in d276ee4 before it shipped.

**Symptom:** on `/discover?view=map`, clicking a price pill did nothing — no selection, no preview card. Clicking the map still worked.

**Cause:** the pills are React elements rendered into a Google Maps overlay pane (`OverlayViewF`, `OVERLAY_MOUSE_TARGET`). Google Maps stops click propagation inside its panes, and React 17+ handles every event at the root container, so React's `onClick` was never reached. Confirmed in the browser: the pill was the top element at the click point and a native listener on it fired; the React handler did not.

**Fix:** `PricePill` in `components/discover/MapView.tsx` attaches its click listener natively in an effect (reading the latest callback from a ref) and stops propagation, so the map's own click handler — which deselects — does not also run.

**Verified:** pill click selects (`aria-pressed`, green), opens the preview with the right company and `/discover/<id>` link; clicking empty map dismisses it.

Any future clickable content inside a Google Maps overlay needs the same treatment.
