/*
* Clappr Quality Selector Plugin v2.0.0
* modded by: ewwink
* github: https://github.com/ewwink/clappr-quality-selector-plugin 
*/

var QualitySelector = Clappr.UICorePlugin.extend({
    name: 'quality_selector',
    
    version: '2.0',

    bindEvents: function () {
        this.listenTo(this.core, Clappr.Events.CORE_READY, this.bindPlaybackEvents);
        this.listenTo(this.core, Clappr.Events.CORE_ACTIVE_CONTAINER_CHANGED, this.reload);
        this.listenTo(this.core.mediaControl, Clappr.Events.MEDIACONTROL_RENDERED, this.render);
        this.listenTo(this.core.mediaControl, Clappr.Events.MEDIACONTROL_HIDE, this.hideSelectLevelMenu);
        this.listenTo(this.core.mediaControl, Clappr.Events.MEDIACONTROL_SHOW, this.showHDIcon);
    },

    unBindEvents: function () {
        var currentPlayback = this.core.activePlayback;

        this.stopListening(this.core, Clappr.Events.CORE_READY);
        this.stopListening(this.core, Clappr.Events.CORE_ACTIVE_CONTAINER_CHANGED);
        this.stopListening(this.core.mediaControl, Clappr.Events.MEDIACONTROL_RENDERED);
        this.stopListening(this.core.mediaControl, Clappr.Events.MEDIACONTROL_HIDE);
        this.stopListening(this.core.mediaControl, Clappr.Events.MEDIACONTROL_SHOW);
        this.stopListening(currentPlayback, Clappr.Events.PLAYBACK_LEVELS_AVAILABLE);
        this.stopListening(currentPlayback, Clappr.Events.PLAYBACK_LEVEL_SWITCH_START);
        this.stopListening(currentPlayback, Clappr.Events.PLAYBACK_LEVEL_SWITCH_END);
        this.stopListening(currentPlayback, Clappr.Events.PLAYBACK_BITRATE);
        this.stopListening(currentPlayback, Clappr.Events.PLAYBACK_STOP);
        this.stopListening(currentPlayback, Clappr.Events.PLAYBACK_PLAY_INTENT);
    },

    bindPlaybackEvents: function () {
        var currentPlayback = this.core.activePlayback;

        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_LEVELS_AVAILABLE, this.fillLevels);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_LEVEL_SWITCH_START, this.startLevelSwitch);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_LEVEL_SWITCH_END, this.stopLevelSwitch);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_BITRATE, this.updateCurrentLevel);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_PLAY_INTENT, this.playbackIntent);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_STOP, this.playbackStop);

        var playbackLevelsAvaialbeWasTriggered = currentPlayback.levels && currentPlayback.levels.length > 0;
        if (playbackLevelsAvaialbeWasTriggered) this.fillLevels(currentPlayback.levels);
    },

    reload: function () {
        this.unBindEvents();
        this.bindEvents();
        this.bindPlaybackEvents();
    },

    shouldRender: function () {
        if (!this.core.activeContainer) return false;
        var currentPlayback = this.core.activePlayback;
        if (!currentPlayback) return false;

        var respondsToCurrentLevel = currentPlayback.currentLevel !== undefined;
        // Only care if we have at least 2 to choose from
        var hasLevels = !!(this.levels && this.levels.length > 1);

        return respondsToCurrentLevel && hasLevels;
    },

    render: function () {
        if (this.shouldRender()) {
            var style = this.pluginStyle;
            this.$el.html(this.template(this.levels, this.getTitle()));
            this.$el.append(style);
            this.core.mediaControl.$('.media-control-right-panel').append(this.el);
            this.highlightCurrentLevel();
        }
        return this;
    },

    template: function (levels, title) {
        var template = '<button data-quality-selector-button>Auto</button><ul>';
        if (title) template += '<li data-title>' + title + '</li>';
        for (var i = levels.length - 1; i > -1; i--) {
            template += '<li><a href="#" data-quality-selector-select="' + levels[i].id + '">' + levels[i].label + '</a></li>';
        }
        template += '<li><a href="#" data-quality-selector-select="-1">AUTO</a></li>';
        return template;
    },

    showHDIcon: function () {
        if (this.HDChecked) return;
        this.HDChecked = true;
        var levels = this.core.activePlayback._hls.levels;
        for (var i = 0; i < levels.length; i++) {
            if (levels[i].height >= 720 || (levels[i].bitrate / 1000) >= 2000) {
                $(this._options.parentId).addClass('showHDIcon');
                break;
            }
        }
    },

    playbackIntent: function () {
        if (!this.FIRST_START) return;
        this.FIRST_START = false;
        this.DEFAULT_QUALITY = parseInt(localStorage.getItem('savedLevelId'));
        var defaultQuality = this.DEFAULT_QUALITY;
        if (isNaN(defaultQuality)) {
            var qsConfig = this._options.qualitySelectorConfig;
            if (qsConfig && !isNaN(qsConfig.defaultQuality))
                defaultQuality = qsConfig.defaultQuality;
        }

        if (!isNaN(defaultQuality)) {
            this.core.activePlayback.currentLevel = this.selectedLevelId = defaultQuality;
        }
    },

    playbackStop: function () {
        this.FIRST_START = true;
    },

    fillLevels: function (levels, initialLevel) {
        if (this.selectedLevelId === undefined)
            this.selectedLevelId = initialLevel ? initialLevel : -1;
        this.levels = levels;
        this.configureLevelsLabels();
        this.render();
    },

    configureLevelsLabels: function () {
        if (this.core.options.qualitySelectorConfig === undefined) return;

        var labelCallback = this.core.options.qualitySelectorConfig.labelCallback;
        if (labelCallback && typeof labelCallback !== 'function')
            throw new TypeError('labelCallback must be a function');

        var hasLabels = this.core.options.qualitySelectorConfig.labels;
        var labels = hasLabels ? this.core.options.qualitySelectorConfig.labels : {};

        if (labelCallback || hasLabels) {
            var level, label;
            for (var i = 0; i < this.levels; i++) {
                level = this.levels[i];
                label = labels[level.id];
                if (labelCallback)
                    level.label = labelCallback(level, label);
                else if (label)
                    level.label = label;
            }
        }
    },

    onLevelSelect: function (event) {
        this.selectedLevelId = parseInt(event.target.dataset.qualitySelectorSelect, 10);
        var hls = this.core.activePlayback._hls;
        if (hls.nextLevel == this.selectedLevelId) return false;
        var currentId = this.selectedLevelId;
        hls.nextLevel = currentId;
        localStorage.setItem('savedLevelId', currentId);

        this.toggleContextMenu();
        event.stopPropagation();
        return false;
    },

    onShowLevelSelectMenu: function () { this.toggleContextMenu(); },

    hideSelectLevelMenu: function () { this.$('.quality_selector ul').hide(); },

    toggleContextMenu: function () { this.$('.quality_selector ul').toggle(); },

    buttonElement: function () { return this.$('.quality_selector button'); },

    levelElement: function (id) { return this.$('.quality_selector ul a' + (!isNaN(id) ? '[data-quality-selector-select="' + id + '"]' : '')).parent(); },

    getTitle: function () { return (this.core.options.qualitySelectorConfig || {}).title; },

    startLevelSwitch: function () { this.buttonElement().addClass('changing'); },

    stopLevelSwitch: function () { this.buttonElement().removeClass('changing'); },

    findLevelBy: function (id) {
        var foundLevel;
        this.levels.forEach(function (level) { if (level.id === id) foundLevel = level; });
        return foundLevel;
    },

    updateText: function (level) {
        if (level === -1)
            this.buttonElement().text(this.currentLevel ? 'AUTO (' + this.currentLevel.label + ')' : 'AUTO');
        else {
            try {
                this.buttonElement().text(this.findLevelBy(level).label);
            }
            catch (ex) {
                localStorage.setItem('savedLevelId', '-1');
                var currentPlayback = this.core.activePlayback;
                currentPlayback.currentLevel = -1;
                currentPlayback.trigger(Clappr.Events.PLAYBACK_LEVEL_SWITCH_END);
                this.updateText(-1);
            }
        }
    },

    updateCurrentLevel: function (info) {
        var level = this.findLevelBy(info.level);
        this.currentLevel = level ? level : null;
        this.highlightCurrentLevel();
    },

    highlightCurrentLevel: function () {
        this.levelElement().removeClass('current');
        if (this.currentLevel) this.levelElement(this.currentLevel.id).addClass('current');
        this.updateText(this.selectedLevelId);
    },

    pluginStyle: '<style>.quality_selector[data-quality-selector]{float:right;position:relative;height:100%}.quality_selector button{cursor:pointer;min-width:80px}.quality_selector[data-quality-selector] button{background-color:transparent;color:#fff;font-family:Roboto,"Open Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased;border:none;font-size:12px;height:100%}.quality_selector[data-quality-selector] button:hover{color:#c9c9c9}.quality_selector[data-quality-selector] button.changing{-webkit-animation:pulse .5s infinite alternate}.quality_selector[data-quality-selector] > ul{list-style-type:none;position:absolute;bottom:100%;display:none;background-color:rgba(28,28,28,0.9);white-space:nowrap}.quality_selector[data-quality-selector] li{font-size:12px;color:#eee}.quality_selector[data-quality-selector] li[data-title]{background-color:#333;padding:8px 25px}.quality_selector[data-quality-selector] li a{color:#eee;padding:5px 10px;display:block;text-decoration:none}.quality_selector[data-quality-selector] li a:hover{background-color:rgba(255,255,255,0.1);color:#fff}.quality_selector[data-quality-selector] li a:hover a{color:#fff;text-decoration:none}.quality_selector[data-quality-selector] li.current a{color:#2ecc71}@-webkit-keyframes pulse{0%{color:#fff}50%{color:#ff0101}100%{color:#B80000}}.showHDIcon button[data-hd-indicator]{display:inline-block !important}</style>',
    
    attributes: {
        'class': 'quality_selector',
        'data-quality-selector': ''
    },

    events: {
        'click [data-quality-selector-select]': 'onLevelSelect',
        'click [data-quality-selector-button]': 'onShowLevelSelectMenu'
    },

    DEFAULT_QUALITY: parseInt(localStorage.getItem('savedLevelId')),

    FIRST_START: true,

    HDChecked: false,
});

Object.defineProperty(QualitySelector, 'name', { value: 'QualitySelector' });

Clappr.Player.prototype.setPlaybackQuality = function (id) {
    var qs = this.getPlugin('quality_selector');
    if (qs.levels && id <= qs.levels.length - 1) {
        qs.selectedLevelId = this.core.activePlayback.currentLevel = id;
        qs.updateCurrentLevel({ level: id });
    }
};

Clappr.Player.prototype.getPlaybackQuality = function () {
    return this.getPlugin('hls').levels;
};
