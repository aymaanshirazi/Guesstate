Background music for Guesstate
==============================

Put ROYALTY-FREE / Creative Commons audio files here (.mp3 or .ogg), then list
them in src/config.js -> MUSIC_TRACKS, e.g.:

  export const MUSIC_TRACKS = [
    { title: "Chill Sunset", file: "/music/chill-sunset.mp3" },
    { title: "Night Drive",  file: "/music/night-drive.mp3" },
  ];

Where to get free, commercial-safe lo-fi:
  - https://pixabay.com/music/  (free, commercial OK, no attribution required)  <-- easiest
  - https://uppbeat.io/  (free tier, needs credit)
  - YouTube Audio Library

DO NOT use copyrighted music (Spotify/YouTube songs, "lofi girl" tracks, etc.).
If a track's license requires credit, add it to the credits in index.html.

The 🎵 music button appears in the top bar once at least one track is listed.
Music never autoplays; the player remembers volume + last track per device.
