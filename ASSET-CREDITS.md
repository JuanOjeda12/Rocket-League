# Asset credits

## Ball - Rocket League

- Creator: **Jako** ([Sketchfab profile](https://sketchfab.com/fairlight51)).
- Original model: https://sketchfab.com/3d-models/ball-rocket-league-2c8911aa1dcd4c53bad842f2d354dfe2
- License: **CC BY 4.0** — https://creativecommons.org/licenses/by/4.0/
- Download mirror: https://github.com/manrajpannu/rl-dart/tree/main/public/models/ball
- Files: `prototype/dist/assets/ball/scene.gltf`, `scene.bin`, `textures/Mat.3_baseColor.png` and original `license.txt`.
- The model is centered and scaled for display to match the existing .9125m collision radius. Original panel texture and emissive details are preserved. No physics changes accompany this visual replacement.
- Attribution: This work is based on "Ball - Rocket League" by Jako, licensed under CC BY 4.0. This is a community model, not an officially supplied game asset.

## Arena surface textures

- **Grass 004**: https://ambientcg.com/view?id=Grass004
- **Metal Plates 006**: https://ambientcg.com/view?id=MetalPlates006
- Creator: ambientCG / Lennart Demes. License: **CC0** — https://docs.ambientcg.com/license/
- Downloaded 1K JPG texture sets. Selected color/normal maps are used for the turf; color/normal/roughness/metalness maps are used on ramps and wall panels. Textures are tiled and tinted for the arena.
- Shipped files are in `prototype/dist/assets/textures/`. The original download archives remain under `assets/texture-downloads/` for reference.

## Octane - Rocket League Car

- Creator: **Jako** ([Sketchfab profile](https://sketchfab.com/fairlight51)).
- Original model: https://sketchfab.com/3d-models/octane-rocket-league-car-9910f0a5d158425bbc7deb60c7a81f69
- License: **Creative Commons Attribution 4.0 International (CC BY 4.0)** — https://creativecommons.org/licenses/by/4.0/
- Downloaded GLB mirror: https://raw.githubusercontent.com/Lambourne2/wrapsrl/main/octane.glb
- File: `assets/octane.glb` (2,856,104 bytes).
- Attribution and license are embedded in the model's `asset.extras` metadata. The prototype uses the model with display scaling and positioning; no geometry changes were made to the downloaded file.
- This is a community model of Rocket League's Octane. Rocket League and Octane belong to their respective owners. This prototype is an independent fan project.

## Integration notes

- Complete textured GLB, including four Dieci wheels. No external textures or Draco decoder required.
- 43,646 triangles; `KHR_materials_clearcoat` is the only declared extension.
- World-space orientation after GLTFLoader: **+X forward, +Y up, +Z right**. Front wheel nodes are named `Dieci - FR (Octane)` and `Dieci - FL (Octane)`.
- Approximate world-space bounds: min `(-66.364, -1.737, -36.212)`, max `(73.517, 60.393, 36.253)`.
- Approximate dimensions: length `139.880`, height `62.130`, width `72.466`.
- For a car facing Three.js -Z, rotate its wrapper Y by `Math.PI / 2`.
- The material named `Paint` can be tinted for team colors.
- The display transform is calibrated to the model's front/rear wheel centres and RocketSim's Octane wheelbase (uniform scale approximately .009872 plus a forward offset of .06646m). Geometry remains unchanged.

## Additional garage models

- **Fennec - Rocket League Car**, Jako, CC BY 4.0. Source: https://sketchfab.com/3d-models/fennec-rocket-league-car-5b43b50b6eeb4a12a29671df3418f57a
- **Dominus - Rocket League Car**, Jako, CC BY 4.0. Source: https://sketchfab.com/3d-models/dominus-rocket-league-car-f592f249a65f41cd81a0e5aa3d418cb2
- Mirror for both: https://github.com/manrajpannu/rl-dart/tree/main/public/models . Original license notices accompany each model in assets/cars/. Runtime modifications: orientation, uniform scale, material tint; original geometry/textures retained.
- **F1 2026 concept (polygon model)**, Qvist_designs, CC BY 4.0. Source: https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42 . Creator: https://sketchfab.com/Qvist_Designs . See assets/cars/f1/ATTRIBUTION.md for inherited APEX derivative modifications. Rocket Arena additionally welds/simplifies the mesh to approximately 97k triangles for browser performance, scales/orients it and permits material tint. This is a generic F1 concept, not the official Rocket League F1 car. No endorsement is implied.

All CC BY assets use https://creativecommons.org/licenses/by/4.0/ . Preserve attribution, source, license and modifications notices when distributing. These community assets are used in an independent fan prototype. Rocket League names and recognizable designs belong to their respective owners.

## Software

- RocketSim by ZealanL, revision c2baacb8f4b441dd8505e63c2aeb5a1679b60b02: https://github.com/ZealanL/RocketSim . MIT license included in dist/engine/ROCKETSIM-LICENSE.
- Bullet Physics, included in the RocketSim build: https://github.com/bulletphysics/bullet3 . License included in THIRD-PARTY-LICENSES/BULLET-LICENSE.txt.
- Three.js: https://github.com/mrdoob/three.js . MIT license in dist/vendor/THREE-LICENSE.txt.
- ws: https://github.com/websockets/ws . MIT license in THIRD-PARTY-LICENSES/WS-LICENSE.txt; exact release pinned by package-lock.json.
- meshoptimizer, used only to prepare the F1 mesh: https://github.com/zeux/meshoptimizer . MIT license in THIRD-PARTY-LICENSES/MESHOPTIMIZER-LICENSE.md.

The release uses the same asset paths under dist/ instead of prototype/dist/. No original game executable, extracted arena mesh or game source is included.

## Stadium artwork (0.4)

The spectator atlas, LED advertising, procedural sky, stadium architecture, glow sprites and UI artwork are generated by this project's source code. No spectator, sky, stadium or boost textures were extracted from Rocket League. The stadium and effects are an original interpretation of the supplied visual references.


## Audio and post-match presentation

All game sound effects are original procedural Web Audio synthesis implemented in game-audio.js (oscillators, filtered noise and envelopes). No sound recordings were extracted from Rocket League. Podium meshes and highlight playback are generated by this project.

## Nexto trained opponent

Model and observation architecture: Rolv-Arild/Necto, https://github.com/Rolv-Arild/Necto (rlbot-support/Nexto). License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0, reproduced in THIRD-PARTY-LICENSES/NEXTO-LICENSE.txt. Contributors are credited in the upstream repository.

Changes: converted unchanged float32 tensor data from the official TorchScript artifact; implemented its two-block EARL attention architecture as local WebAssembly SIMD inference; ported the observation builder and action table to JavaScript; connected original physical states and controls to RocketSim. The adapted model-specific files nexto-controller.js, nexto-model.js and engine/nexto/ are distributed under CC BY-NC-SA 4.0. The original project does not endorse this browser game.

The circular flip reset cue is original geometry and audio inspired by Rocket League v2.66; no game texture or sound file was extracted.

## Necto V1 trained opponent
Official model: https://github.com/Rolv-Arild/Necto/tree/master/rlbot-support/Necto . CC BY-NC-SA 4.0, same license as Nexto (THIRD-PARTY-LICENSES/NEXTO-LICENSE.txt). Unchanged trained weights converted to float32; one-block EARL attention and five discrete action heads ported to WASM SIMD; original observation/action conventions adapted to RocketSim. necto-model.js, necto-controller.js and engine/necto/ inherit CC BY-NC-SA 4.0. No endorsement.
