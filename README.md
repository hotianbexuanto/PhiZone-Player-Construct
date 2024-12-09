# PhiZone Player

PhiZone Player is an HTML5 Phigros chart player/simulator based on Phaser.

### Frameworks

This project is made possible by:

- [Phaser](https://github.com/phaserjs/phaser)
- [Svelte](https://github.com/sveltejs/kit)
- [Vite](https://github.com/vitejs/vite)
- [TypeScript](https://github.com/microsoft/TypeScript)

## Introduction

Much of this program resembles any other Phigros chart player/simulator, so this section will focus solely on its unique features.

### User-friendly landing page

Designed with [Preline UI](https://preline.co) and [daisyUI](https://daisyui.com), the landing page is meticulously written to be as intuitive yet powerful as possible.

Choose either some files (or .zip/.pez archives) or an entire folder, and chart bundles will be automatically detected according to Re: PhiEdit (or RPE) metadata files (typically named `info.txt`) in which a chart, a song, and an illustration are specified. Any other files that fail to be recognized, which are most likely multimedia that will be referenced by the chart, or the `extra.json` from Phira, will be presented in the assets.

### Keyboard controls for autoplay

Similar to a video player, the program includes intuitive keyboard controls on autoplay mode:

- Pause/Resume: Press <kbd>Space</kbd> to toggle.
- Rewind/Forward: Use <kbd>←</kbd> / <kbd>→</kbd> to jump 5 seconds, or <kbd>⇧ Shift</kbd>+<kbd>←</kbd> / <kbd>⇧ Shift</kbd>+<kbd>→</kbd> for precise 0.1-second adjustments.

### APNG support

Animated PNGs are an excellent alternative to GIFs, offering enhanced color fidelity and the support of an 8-bit alpha channel for smoother transparency effects.

While there hasn't been support for GIF events, APNGs are planned to act exactly the same as GIFs.

### Chart enhancements

Aside from adding support for RPE features, we've also designed some original properties for judgment lines & notes.

| Property         | Values                                      | Example                         | Description                                                                |
| ---------------- | ------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `scaleOnNotes`   | `0`: none; `1`: scale; `2`: clip            | `"scaleOnNotes": 2`             | Belongs to a judgment line. Decides how `scaleX` events will affect notes. |
| `tint`           | [R, G, B], as seen in `colorEvents`; `null` | `"tint": [255, 0, 0]`           | Belongs to a note. Sets the tint for the note.                             |
| `tintHitEffects` | [R, G, B], as seen in `colorEvents`; `null` | `"tintHitEffects": [255, 0, 0]` | Belongs to a note. Sets the tint for the hit effects of the note.          |

### Shader enhancements

Except for WebGL's incompatibilities with newer versions of GLSL, the program supports not only all the shader features defined by `extra.json` from Phira, but also one original addition to the standard: **target range**.

A target range defines a list of depth-adjacent (next to each other on the Z axis) game objects that a shader event is applied to. It belongs directly to a shader event (as the optional `targetRange` property) and consists of the following properties:

| Property               | Type    | Description                                                                                                                                                                             |
| ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minZIndex`            | Number  | Defines the minimum Z index (depth) of this range. Inclusive.                                                                                                                           |
| `maxZIndex`            | Number  | Defines the maximum Z index (depth) of this range. Exclusive.                                                                                                                           |
| `exclusive` (optional) | Boolean | Determines whether this range should exclude the range of another active shader event when the two ranges intersect but this range is not a superset of the other. Defaults to `false`. |

If the `global` property of a shader event is set to `true`, then its `targetRange` will not function.

One thing to note is that a single object cannot be rendered in parallel by two or more shaders. However, a set of targets from one shader event can be safely contained within the targets of another shader event. This leads to the concept of the `exclusive` property - it determines whether or not to "swallow" another set of objects when it intersects with but is not a subset of the current.

The Z index (depth) defines the order in which game objects are rendered. The lower the value, the earlier they are rendered.

| Z index (depth) | Object(s)                                                                  |
| --------------- | -------------------------------------------------------------------------- |
| 0               | Illustration                                                               |
| 1               | Background video, if present                                               |
| [2, 3)          | Judgment lines, the order of which are determined by their `zOrder` values |
| 3               | Hold notes                                                                 |
| 4               | Drag notes                                                                 |
| 5               | Tap notes                                                                  |
| 6               | Flick notes                                                                |
| 7               | Hit effects                                                                |
| 8               | Pause button                                                               |
| 9               | Combo counter                                                              |
| 10              | Text beneath the combo counter                                             |
| 11              | Score                                                                      |
| 12              | Std deviation & accuracy                                                   |
| 13              | Progress bar                                                               |
| 14              | Song title                                                                 |
| 15              | Level name & difficulty                                                    |

The Z indexes of judgment lines are calculated based on their `zOrder` values ([code here](https://github.com/PhiZone/player/blob/ed8a6119a28c8594d372aacb8e1da12fdce6d692/src/player/utils.ts#L595)). Simply put, the values are mapped onto [0, 1) and made equally spaced, and then get added by 2 to become Z indexes. See examples below.

| `zOrder`           | Z index               |
| ------------------ | --------------------- |
| 0, 10, 20, 30      | 2, 2.25, 2.5, 2.75    |
| 127, 0, 0, 1       | 2.6667, 2, 2, 2.3333  |
| 1, 2, 5, 6, 114514 | 2, 2.2, 2.4, 2.6, 2.8 |

<details>
  <summary>Click to show an example of <code>extra.json</code> incorporating target ranges.</summary>

```jsonc
{
  // ...
  "effects": [
    {
      "start": [293, 0, 1],
      "end": [300, 0, 1],
      "shader": "/example.glsl",
      "global": false,
      "targetRange": {
        "minZIndex": 3,
        "maxZIndex": 4,
      }, // Hold notes
      "vars": {
        // ...
      },
    },
    {
      "start": [293, 0, 1],
      "end": [463, 0, 1],
      "shader": "/example.glsl",
      "global": false,
      "targetRange": {
        "minZIndex": 8,
        "maxZIndex": 16,
      }, // The entire UI
      "vars": {
        // ...
      },
    },
    {
      "start": [66, 0, 1],
      "end": [296, 0, 1],
      "shader": "/another-example.glsl",
      "global": true,
      // targetRange is optional
      "vars": {
        // ...
      },
    },
  ],
}
```

Notice that there are two events that share the same shader code. This is a workaround when you want to apply the same shader to objects that are not adjacent on the Z axis.

</details>

## Requirements

[`pnpm`](https://pnpm.io) is required to install dependencies and run scripts.

## Commands

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `pnpm i`           | Installs project dependencies                    |
| `pnpm dev`         | Launches a development web server                |
| `pnpm build`       | Creates a production build in the `build` folder |
| `pnpm tauri build` | Creates a production build for desktop           |

## Development

| Feature                                    | Version | Remark                                                                        | Status/Progress   | 功能                    |
| ------------------------------------------ | ------- | ----------------------------------------------------------------------------- | ----------------- | ----------------------- |
| Basic RPE support                          | 0.0.1   |                                                                               | ✅ Done           | 基本 RPE 适配           |
| Support for custom line textures           | 0.0.1   |                                                                               | ✅ Done           | 判定线自定义贴图适配    |
| Support for flipping modes                 | 0.0.1   |                                                                               | ✅ Done           | 镜像模式适配            |
| Support for custom hit sounds              | 0.0.1   |                                                                               | ✅ Done           | 自定义打击音效适配      |
| Support for `zOrder`                       | 0.0.1   |                                                                               | ✅ Done           | Z 轴排序适配            |
| Basic support for the extended event layer | 0.0.2   | Excluding GIF events & incline events                                         | ✅ Done           | 扩展事件层的基本适配    |
| Cross-platform distribution                | 0.0.3   | Plan to reference [this blog](https://nsarrazin.com/blog/sveltekit-universal) | 🚧 Working        | 跨平台分发              |
| Better input detections                    | 0.0.3   | Especially for Flicks                                                         |                   | 输入检测优化            |
| Support for Phira `extra.json`             | 0.0.4   | Including shaders                                                             | 🛠️ Tests required | Phira `extra.json` 适配 |
| Support for `attachUI`                     | 0.0.4   |                                                                               | ✅ Done           | UI 绑定适配             |
| Support for anchors                        | 0.0.4   |                                                                               | ✅ Done           | 锚点适配                |
| Support for APNGs                          | 0.0.4   |                                                                               | ✅ Done           | APNG 格式适配           |
| Shader feature enhancements                | 0.0.5   |                                                                               | ✅ Done           | 着色器功能增强          |
| Support for Bézier easings                 | 0.0.5   |                                                                               |                   | 贝塞尔缓动适配          |
| Offset adjustment mode                     | 0.0.5   |                                                                               |                   | 延迟调整模式            |
| Alignment with official/RPE constants      | 0.0.6   | Hold tolerances, texture size units, etc.                                     |                   | 官/RPE 常数对齐         |
| Full support for the extended event layer  | 0.0.6   | GIF events & incline events                                                   |                   | 扩展事件层的完全适配    |
| Recording mode                             | 0.0.7   |                                                                               | ⏳ Postponed      | 录制模式                |
| Support for all note properties            | 0.0.7   |                                                                               |                   | 所有 Note 属性的适配    |
| Note property enhancements                 | 0.0.8   |                                                                               |                   | Note 属性增强           |
| Full RPE support                           | 0.1.0   |                                                                               |                   | 完全 RPE 适配           |
| Basic PE support                           | 0.1.1   |                                                                               |                   | 基本 PE 适配            |
| Customizable resource pack                 | 0.1.2   |                                                                               |                   | 可自定义资源包          |
| PhiZone integration                        | 0.2.0   |                                                                               |                   | PhiZone 集成            |

A version is reached whenever at least one feature from this version and all features from the previous versions are marked as `✅ Done`. A version is released only when all features from this version and the previous versions are marked as `✅ Done`.

## Assets

Game assets are stored in `./static/game`. A tree view of the folder is as follows:

```
game
│  HitEffects.png
│  line.png
│  Pause.svg
│  Progress.png
│
├─ending
│      GradeHit.wav
│      LevelOver0.wav
│      LevelOver1.wav
│      LevelOver2.wav
│      LevelOver3.wav
│      LevelOver4.wav
│
├─grades
│      .gitkeep
│      A.png
│      B.png
│      C.png
│      F.png
│      Phi.png
│      S.png
│      V-FC.png
│      V.png
│
├─hitsounds
│      .gitkeep
│      Drag.wav
│      Flick.wav
│      Tap.wav
│
├─notes
│      .gitkeep
│      Drag.png
│      DragHL.png
│      Flick.png
│      FlickHL.png
│      Hold.png
│      HoldEnd.png
│      HoldEndHL.png
│      HoldHead.png
│      HoldHeadHL.png
│      HoldHL.png
│      Tap.png
│      TapHL.png
│
└─shaders
        chromatic.glsl
        circle_blur.glsl
        fisheye.glsl
        glitch.glsl
        grayscale.glsl
        noise.glsl
        pixel.glsl
        radial_blur.glsl
        shockwave.glsl
        vignette.glsl
```

According to [a statement from Pigeon Games](https://www.bilibili.com/opus/624904779363026292), assets from Phigros are copyrighted, and their appearance in other software is legally prohibited. This restriction applies to all assets in this folder except for all shaders (`shaders/*`, the majority of which are licensed under MIT/CC0, with a few exceptions from [ShaderToy](https://www.shadertoy.com) licensed under the default [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) license specified by the site), `Pause.svg` (by Font Awesome, licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)) and `ending/GradeHit.wav` (by Naptie with sound effects on [Pixabay](https://pixabay.com), licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)). If you wish to run this program on your own, please be sure to append the missing assets as aforementioned.

## Deployments

We're unable to provide an official deployment (which is to be available at https://player.phi.zone) due to lack of proper game assets. Anyone willing to provide a properly licensed set of assets and allow us to use and distribute it is welcome to contact us at [contact@phi.zone](mailto:contact@phi.zone) or instead create a pull request in this repository.

## Stargazers over time

[![Stargazers over time](https://starchart.cc/PhiZone/player.svg?variant=adaptive)](https://starchart.cc/PhiZone/player)

&copy; PhiZone.

Some rights reserved.