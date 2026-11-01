# Fishman Adventure v32 — Gameplay and Weapon Design Plan

Status: design specification; not yet implemented. Preserve the existing ten chapters, character art, bosses, saves, and host-authoritative co-op.

## Core gameplay loop
Explore a distinct level space → discover a chapter mechanic → complete two varied objectives → encounter an escalating challenge → defeat or outsmart a boss → earn a meaningful weapon/skill upgrade. Provide optional secrets, checkpoints, and a chapter-specific replay medal. Do not require grinding.

## Chapter variety (map to existing chapter story and titles before implementation)
1. Coral discovery: rescue creatures, bubble-switch puzzles, hidden routes; teach controls.
2. Sunken treasure: keys, trap timing, defend treasure; branching paths.
3. Jellyfish maze: moving electric hazards, switch order, route changes.
4. Naughty fortress: shield generators, miniboss phases, arena movement; retain original boss HP and phases.
5. Volcanic escape: rising hazard, cooling valves, collapsing platforms; generous checkpoint.
6. Ancient temple: redirect energy, pressure plates, cooperative switch option (solo always solvable).
7. Deep sea: visibility, sonar, stealth predator patrols.
8. Frozen kingdom: sliding momentum, ice barriers, reflections.
9. Whirlpool: moving currents, rotating platforms, objective defence.
10. Finale: recombine learned mechanics, preserve nine-boss rush and final encounter.

## Weapons: meaningful tactical differentiation
- Bubble: slow and trap foes; operate water-pressure switches. Lv5 bubble prison and splash.
- Rapid: accurate sustained fire; hit moving switches. Lv5 piercing barrage.
- Spread: close-range armour breaking; break brittle walls. Lv5 wide cone knockback.
- Charge: telegraphed heavy area blast; break reinforced gates. Lv5 nova.
- Homing: track evasive enemies; activate moving distant targets. Lv5 rocket swarm.
- Electric: short-range chain/stun; energise circuits. Lv5 lightning storm.
Every weapon needs a distinct silhouette, impact feedback, audio cue, cooldown indicator, and target-type advantage. Avoid mandatory weapon softlocks: offer an alternate path or nearby weapon pickup.

## Progression and fairness
Five levels per weapon; show level, next upgrade and skill description. Duplicates improve owned weapons; max-level pickups convert to useful resources. Keep unlocks and upgrades across chapter transitions. Prefer temporary shield/charge loss over permanent weapon loss on ordinary damage; test save migrations. Do not punish novice players for trying different weapons.

## Encounter pacing
Mix navigation, traversal, puzzle, combat, timed escape and boss patterns. Change objective approximately every 1–3 minutes; avoid endless identical enemies. Introduce each mechanic safely, then combine it with combat, then test mastery. Three difficulty presets adjust enemy aggression and timing, not puzzle logic. Co-op increases enemy pressure and adds optional synchronized bonuses but never makes solo completion impossible.

## Implementation order and acceptance criteria
A. Audit actual chapter IDs, level generation, combat collision, save and multiplayer synchronization.
B. Fix weapon equip and hit reliability, boss damage parity, pickup duplication, level cap and P2 ownership; add browser regression tests.
C. Prototype chapter 1 interactive bubble switches and chapter 2 key/trap/defence objective, including HUD prompts, checkpoints and success/fail states.
D. Build reusable objective engine: triggers, switches, timers, environmental hazards, moving platforms and saveable checkpoints.
E. Apply distinct mechanic per remaining chapter without replacing approved art or boss scripts.
F. Polish weapon models, animation, telegraphs, hit-stop, particles and sound; benchmark mobile performance.
G. Run Chromium/WebKit, touch, keyboard, solo and two-player QA; ship only after passing tests.

## Quality gates
- Every chapter has at least two non-combat interactions and a unique central mechanic.
- No chapter is completable by holding fire and walking forward alone.
- All six weapons have measurable, different roles and visible level-5 effects.
- Solo and co-op can finish all chapters; progress persists and old saves migrate.
- No regressions to the existing ten chapters, bosses or approved character art.

## Story canon correction — mandatory (2026-11-01)
The prior generic chapter names in this plan are **discarded**. Do not rename, reorder or replace the established ten-chapter Fishman story:
1. Fishman Experiment — origin/experiment escape and learning powers.
2. Naughty's Secret Power — Kai's potion activates Naughty's inherited tree gene; forest and discovery.
3. Underwater Allies — underwater recruitment, exploration and swimming.
4. Roxy's City Battle — city streets, giant Naughty, Roxy (T. rex) confronts Naughty's nuclear bomb; Fishman brings spiky puffer fish, Humpty reveals tiny Godzilla. Include city rescue, debris dodging, vertical rooftop routes, boss telegraphs and a bomb-disabling sequence.
5. McTreeFace Boss Battle — retain established three-phase boss.
6. Yellow Submarine — vehicle exploration and submarine combat.
7. Sunken Library — environmental puzzles and hidden knowledge.
8. Whirlpool Caverns — current navigation and timing.
9. Barky's Root Fortress — infiltration, root traps and fortress fight.
10. Ocean Light Festival — preserve final nine-boss rematch gauntlet and finale.

Story constraints: Naughty is a **human boy** with inherited tree powers activated by Kai's potion, never literally a tree. Roxy is a **T. rex**, not a shark. Preserve forest, city, underwater, library, caverns, fortress and festival settings. Preserve land/water movement differences and underwater-only Sub. Each chapter ends with a boss; the chapter 10 finale rematches all nine bosses. The city battle is essential, not optional. Implement missions as interactive mechanics rather than cosmetic scenery. Any generic chapter suggestions above are superseded by this section.
