# Sadia's Birthday Website

## New atmosphere and music
- `images/sadia-dreamscape.png` is the AI-created illustrated background used behind the whole website.
- The background gently shifts with scrolling and pointer movement; petals and firefly-like lights drift over it.
- The floating music control plays an original soft generated melody by default.
- To use a song you own or have permission to use, put its MP3 in the `music/` folder and set `music.src` in `config.js`, for example:

```js
music: {
  title: "Our song",
  src: "music/our-song.mp3",
  volume: 0.24,
},
```

Leave `src` as an empty string to use the built-in generated melody. Browsers require a user tap before audio can start, so Sadia can start or pause it from the floating music button.

## Run
- Run `npm install` if dependencies are not installed.
- Run `npm start`.
- Open the Replit web preview.

The existing gatekeeper, quiz, love notes, letter, gallery and guestbook are retained. Guestbook data remains in `Data/wishes.json`.


## Add the scratchable Polaroid photos

The birthday gallery now has 8 scratch-to-reveal Polaroids. Add your photos to the
`images` folder with these exact filenames:

- `memory1.jpg`
- `memory2.jpg`
- `memory3.jpg`
- `memory4.jpg`
- `memory5.jpg`
- `memory6.jpg`
- `memory7.jpg`
- `memory8.jpg`

You can add fewer than eight photos for now; the remaining Polaroids will show
a placeholder until you add their image files. Open the birthday page and scratch
the silver layer with your mouse or finger to reveal each photo.
