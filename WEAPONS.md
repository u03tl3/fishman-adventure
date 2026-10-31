# Fishman Adventure — Weapon Guide (v31)

The original 3D-cartoon characters, backgrounds, bosses, collectibles and ten chapters remain unchanged. Weapon projectiles and impact effects now have their own dimensional visual identities.

## Six weapons

| Weapon | Signature attack | Level milestones | Combat role |
|---|---|---|---|
| Bubble / Gadget | Large luminous bubble with slowing water effects | Lv.3 two bubbles; Lv.4 stronger slow; Lv.5 three bubbles and splash | Balanced all-round |
| Rapid Blaster | Fast cyan pulse bolts | Lv.1 twin burst; Lv.3 triple burst; Lv.5 piercing bolts | High rate, light per-hit damage |
| Triple Barrel | Orange short-range scatter pellets | Lv.1 five pellets; Lv.3 seven; Lv.5 nine | Close-range spread |
| Charge Cannon | Heavy violet plasma ball, circular shockwave and area impact | Increasing blast size and damage each level; Lv.5 largest nova | Slower, heavy area damage |
| Homing Pod | Guided green rockets with thrust trails and small explosions | Lv.1 two rockets; Lv.3 three; Lv.5 four | Mobile-target pursuit |
| Electric Arc | Instant branching lightning with stun, **no ordinary projectile** | Lv.1 two chain targets; Lv.3 four; Lv.5 six | Crowd control |

All weapons gain damage as their level increases (maximum level **5**). Different cooldown, velocity, number of shots, splash and crowd-control characteristics make them play differently even when the same hero equips them.

## Upgrade and selection rules

- Find a new weapon core to unlock and equip its weapon.
- Collect another core for a weapon already owned to **upgrade that specific weapon**.
- Golden cores and five-star rewards upgrade the currently equipped weapon.
- Boss star milestones also contribute weapon upgrades.
- Owned weapons and weapon levels are saved in local game progress, survive chapter restarts and are restored when starting a different chapter.
- Tap the weapon panel to switch to a previously unlocked weapon. Online Player 2 can switch independently; the host validates their input.
- Existing damage penalties can reduce a level or remove a secondary weapon if a player is hit without an active weapon shield; weapons can be recovered through future pickups.

## Design and balance constraints

- All original chapter bosses, McTreeFace's three phases, the nine-boss final rush and their health values are preserved.
- Weapon damage is calculated independently for each projectile, including area effects; hazards are no longer all reduced by exactly one hit regardless of weapon.
- The approved hero artwork remains the priority. Visual changes here only affect weapon projectiles, trails, lightning and impacts.
- Multiplayer uses host-authoritative weapon actions and keeps each player's weapon inventory and upgrades separate during play. Persistent browser progress belongs to the local solo/host player.
- Browser regression tests cover Chromium and WebKit. CI must pass before deployment.
