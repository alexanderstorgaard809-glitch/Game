# Slice Tycoon

A small isometric business game played in the browser with mouse and keyboard.

**Step 1:** an isometric city map, your pizzeria (click it to go inside), cash and day/time on screen, and auto-save.

**Step 2 (this version):** build mode inside the pizzeria. Build walls and doors, and buy and place a kitchen counter, pizza oven, cash register, dining tables and chairs. You see a preview before you buy, items can be rotated, and blocked spots are shown in red with the reason. Everything you build is saved.

**Step 3:** staff. Hire and fire a cook, a cashier and a waiter in the staff window (`P`), and set each person's shift. On shift, they walk in through the entrance to their workstation (pizza oven, cash register, kitchen counter), finding their way around walls and through doors. If a station is missing, taken, or can't be reached, a warning says so. Wages are paid for every hour of a shift.

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
| Build mode (inside) | `B` or the *Build & furnish* button |
| Place / build | Click. Drag along the floor lines to build several walls at once |
| Rotate furniture | `R` or the *Rotate* button |
| Stop the current tool | Right-click or `Esc` |
| Sell something | *Remove* tool, then click it (you get 50% back) |
| Staff window | `P` or the *Staff* button |
| Pause / resume | `Space` |
| Game speed | `1`, `2`, `3` |

The game saves to the browser's `localStorage` every 5 seconds, when you enter or leave a building, and when you close the tab. Use **New game** in the bottom-right corner to start over.

## Code layout

- `js/iso.js`: isometric projection and drawing helpers
- `js/save.js`: saving and loading
- `js/city.js`: the city map and the pizzeria building
- `js/furniture.js`: the furniture catalog, prices, and how each piece is drawn
- `js/layout.js`: walls, doors and items in a room, plus the placement rules
- `js/interior.js`: drawing the room inside a business, with depth sorting
- `js/build.js`: build mode (tools, preview, buying and selling)
- `js/business.js`: staff roles, applicants, shifts, and saving business data
- `js/path.js`: walkable tiles and shortest paths around walls and through doors
- `js/sim.js`: the running business (who is on shift, walking, workstations, warnings, wages)
- `js/people.js`: drawing people
- `js/manage.js`: the staff window
- `js/main.js`: game loop, input, camera, HUD and switching between scenes
