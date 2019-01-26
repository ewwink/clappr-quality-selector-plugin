/*
* Clappr Quality Selector Plugin v1.0
* modded by: ewwink
* github: https://github.com/ewwink/clappr-quality-selector-plugin 
*/

var AUTO = -1;
var DEFAULT_QUALITY_ID = parseInt(localStorage.getItem('savedLevelId'));
var FIRST_START = true;

var QualitySelector = Clappr.UICorePlugin.extend({
    name: 'quality_selector',
    version: '1.0',
    pluginStyle: '<style>.quality_selector[data-quality-selector]{float:right;position:relative;height:100%}.quality_selector button{cursor:pointer;min-width:80px}.quality_selector[data-quality-selector] button{background-color:transparent;color:#fff;font-family:Roboto,"Open Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased;border:none;font-size:12px;height:100%}.quality_selector[data-quality-selector] button:hover{color:#c9c9c9}.quality_selector[data-quality-selector] button.changing{-webkit-animation:pulse .5s infinite alternate}.quality_selector[data-quality-selector] > ul{list-style-type:none;position:absolute;bottom:100%;display:none;background-color:rgba(28,28,28,0.9);white-space:nowrap}.quality_selector[data-quality-selector] li{font-size:12px;color:#eee}.quality_selector[data-quality-selector] li[data-title]{background-color:#333;padding:8px 25px}.quality_selector[data-quality-selector] li a{color:#eee;padding:5px 10px;display:block;text-decoration:none}.quality_selector[data-quality-selector] li a:hover{background-color:rgba(255,255,255,0.1);color:#fff}.quality_selector[data-quality-selector] li a:hover a{color:#fff;text-decoration:none}.quality_selector[data-quality-selector] li.current a{color:#2ecc71}@-webkit-keyframes pulse{0%{color:#fff}50%{color:#ff0101}100%{color:#B80000}}.showHDIcon{display:inline-block !important}</style>',
    attributes: {
        'class': 'quality_selector',
        'data-quality-selector': ''
    },

    events: {
        'click [data-quality-selector-select]': 'onLevelSelect',
        'click [data-quality-selector-button]': 'onShowLevelSelectMenu'
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

    bindEvents: function () {
        this.listenTo(this.core, Clappr.Events.CORE_READY, this.bindPlaybackEvents);
        this.listenTo(this.core, Clappr.Events.CORE_ACTIVE_CONTAINER_CHANGED, this.reload);
        this.listenTo(this.core.mediaControl, Clappr.Events.MEDIACONTROL_RENDERED, this.render);
        this.listenTo(this.core.mediaControl, Clappr.Events.MEDIACONTROL_HIDE, this.hideSelectLevelMenu);
    },

    unBindEvents: function () {
        this.stopListening(this.core, Clappr.Events.CORE_READY);
        this.stopListening(this.core, Clappr.Events.CORE_ACTIVE_CONTAINER_CHANGED);
        this.stopListening(this.core.mediaControl, Clappr.Events.MEDIACONTROL_RENDERED);
        this.stopListening(this.core.mediaControl, Clappr.Events.MEDIACONTROL_HIDE);
        this.stopListening(this.core.activePlayback, Clappr.Events.PLAYBACK_LEVELS_AVAILABLE);
        this.stopListening(this.core.activePlayback, Clappr.Events.PLAYBACK_LEVEL_SWITCH_START);
        this.stopListening(this.core.activePlayback, Clappr.Events.PLAYBACK_LEVEL_SWITCH_END);
        this.stopListening(this.core.activePlayback, Clappr.Events.PLAYBACK_BITRATE);
    },

    bindPlaybackEvents: function () {
        var currentPlayback = this.core.activePlayback;

        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_LEVELS_AVAILABLE, this.fillLevels);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_LEVEL_SWITCH_START, this.startLevelSwitch);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_LEVEL_SWITCH_END, this.stopLevelSwitch);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_BITRATE, this.updateCurrentLevel);
        this.listenTo(currentPlayback, Clappr.Events.PLAYBACK_PLAY, this.playbackPlay);
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

    playbackPlay: function () {
        var levels = this.core.activePlayback._hls.levels;
        for (var i = 0; i < levels.length; i++) {
            if (levels[i].height >= 720 || (levels[i].bitrate / 1000) >= 2000) {
                $('button[data-hd-indicator]').addClass('showHDIcon');
            }
        }
    },
    playbackStop: function () {
        FIRST_START = true;
    },
    fillLevels: function (levels, initialLevel) {
        if (this.selectedLevelId === undefined)
            this.selectedLevelId = initialLevel ? initialLevel : AUTO;
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
            for (var levelId in this.levels) {
                level = this.levels[levelId];
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
        if (this.core.activePlayback.currentLevel == this.selectedLevelId) return false;
        var currentId = this.selectedLevelId;
        this.core.activePlayback.currentLevel = currentId;
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
        this.levels.forEach((level) => { if (level.id === id) foundLevel = level; });
        return foundLevel;
    },

    updateText: function (level) {
        if (level === AUTO)
            this.buttonElement().text(this.currentLevel ? 'AUTO (' + this.currentLevel.label + ')' : 'AUTO');

        else
            this.buttonElement().text(this.findLevelBy(level).label);

    },
    updateCurrentLevel: function (info) {
        var _this = this;
        var hls = this.core.activePlayback._hls;
        hls.on('hlsLevelLoading', function () {
            DEFAULT_QUALITY_ID = parseInt(localStorage.getItem('savedLevelId'));
            if (isNaN(DEFAULT_QUALITY_ID)) {
                var qsConfig = _this._options.qualitySelectorConfig;
                if (qsConfig && !isNaN(qsConfig.defaultQuality))
                    DEFAULT_QUALITY_ID = parseInt(qsConfig.defaultQuality);
            }

            if (!isNaN(DEFAULT_QUALITY_ID)) {
                var levelCount = this.levels.length - 1;
                if (DEFAULT_QUALITY_ID != this.currentLevel && DEFAULT_QUALITY_ID <= levelCount && FIRST_START) {
                    FIRST_START = false;
                    this.currentLevel = _this.selectedLevelId = DEFAULT_QUALITY_ID;
                    _this.core.activePlayback.currentLevel = DEFAULT_QUALITY_ID;
                    _this.core.activePlayback.trigger(Clappr.Events.PLAYBACK_LEVEL_SWITCH_END);
                }
            }

        });
        var level = this.findLevelBy(info.level);
        this.currentLevel = level ? level : null;
        this.highlightCurrentLevel();
    },
    highlightCurrentLevel: function () {
        this.levelElement().removeClass('current');
        if (this.currentLevel) this.levelElement(this.currentLevel.id).addClass('current');
        this.updateText(this.selectedLevelId);
    }
});

Object.defineProperty(QualitySelector, 'name', { value: 'QualitySelector' });
Object.defineProperty(QualitySelector, 'version', { value: '1.0' });

Clappr.Player.prototype.setPlaybackQuality = function (id) {
    var hls = this.getPlugin('hls');
    var qsel = this.getPlugin('quality_selector');
    if (id <= hls.levels.length - 1) {
        hls.currentLevel = this.selectedLevelId = qsel.selectedLevelId = id;
        qsel.updateCurrentLevel({ level: id });

    }
};

Clappr.Player.prototype.getPlaybackQuality = function () {
    return this.getPlugin('hls').levels;
};
