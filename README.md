# Slice Tycoon

A small isometric business game played in the browser with mouse and keyboard.

**Step 1 (this version):** an isometric city map, your pizzeria (click it to go inside), an empty interior you can leave again, cash and day/time shown on screen, and auto-save.

## How to play

No install or build step is needed.

1. Download or clone this repository.
2. Double-click `index.html` to open it in Chrome, Edge or Firefox.

If your browser blocks local files, run a small web server from the project folder instead:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

| Action | Input |
|---|---|
| Go inside the pizzeria | Click it |
| Move the map | Drag with the mouse, or WASD / arrow keys |
| Zoom | Mouse wheel |
| Leave the pizzeria | `Esc`, the *Back to city* button, or click the door |
| Pause / resume | `Space` |
| Game speed | `1`, `2`, `3` |

The game saves to the browser's `localStorage` every 5 seconds, when you enter or leave a building, and when you close the tab. Use **New game** in the bottom-right corner to start over.

## Code layout

- `js/iso.js`: isometric projection and drawing helpers
- `js/save.js`: saving and loading
- `js/city.js`: the city map and the pizzeria building
- `js/interior.js`: the room inside a business
- `js/main.js`: game loop, input, camera, HUD and switching between scenes
