
# Clappr Quality Selector Plugin

It's modified version of [clappr-level-selector-plugin](https://github.com/clappr/clappr-level-selector-plugin) with the following **extra features**:

- Persistent quality level between session.
-  `defaultQuality` options to set quality when player start
-  `setPlaybackQuality()` function to select quality by `ID` this method
   have to be called after `PLAYBACK_LEVELS_AVAILABLE` or media played.
-  `getPlaybackQuality` function to get available quality levels, must
   be called like above. 
- Reordering the Quality placement, from the bottom to the top are `AUTO` to the highest quality level.   
- `HD` icon displayed by default if in playlist it has HD Quality.
- Small size, 3KB gzipped.

<img src="https://raw.githubusercontent.com/ewwink/clappr-quality-selector-plugin/master/clappr-quality-selector.jpg"/>

## Usage

Add both Clappr and Quality Selector plugin scripts to your HTML:

```html
  <script type="text/javascript" src="//cdn.jsdelivr.net/npm/clappr@latest/dist/clappr.min.js"></script>
  <script type="text/javascript" src="//cdn.jsdelivr.net/gh/ewwink/clappr-quality-selector-plugin@latest/quality-selector.js"></script>
```

Then just add `QualitySelector` into the list of plugins of your player instance:

```javascript
var player = new Clappr.Player({
  source: "http://your.video/here.m3u8",
  plugins: [QualitySelector]
});
```

You can also customize the labels, title, and quality:

```javascript
var player = new Clappr.Player({
  source: "http://your.video/here.m3u8",
  plugins: [QualitySelector],
  qualitySelectorConfig: {
    title: 'Quality',
    labels: {
      2: 'High', // 500kbps
      1: 'Med', // 240kbps
      0: 'Low', // 120kbps
    },
    defaultQuality: 0, // start with quality 0 or Low
    labelCallback: function(playbackLevel, customLabel) {
      return customLabel + playbackLevel.level.height + 'p'; // High 720p
    }
  },
  events: {
    onPlay: function() {
      setTimeout(function() {
        player.getPlaybackQuality(2); // log the levels
        player.setPlaybackQuality(2); // Change to highest level
      }, 10000); // fired after 10 second playing
    }
  }
});
```



## Plugin Compatibility

Require Clappr v0.3.0 or above
