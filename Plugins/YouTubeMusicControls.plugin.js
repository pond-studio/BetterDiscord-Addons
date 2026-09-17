/**
 * @name YouTubeMusicControls
 * @author voyhel
 * @authorId 496360025099337728
 * @version 1.0.1
 * @description Adds a Control Panel above the account panel for the pear-desktop app
 * @source https://github.com/pond-studio/BetterDiscord-Addons/blob/main/Plugins/YouTubeMusicControls.plugin.js
 * @updateUrl https://raw.githubusercontent.com/pond-studio/BetterDiscord-Addons/main/Plugins/YouTubeMusicControls.plugin.js
 */

/*
	Requires the "API Server" plugin to be enabled inside the pear-desktop app.
	(https://github.com/pear-devs/pear-desktop)

	If the API server's auth strategy is not NONE, click "Authorize" in the settings panel and confirm the prompt inside the YouTube Music app.
*/

module.exports = class YouTubeMusicControls {
    constructor(meta) {
        this.meta = meta;

        this.defaults = {
            host: 'localhost',
            port: 26538,
            accessToken: '',
            addTimeline: true,
            buttons: {
                like: true,
                dislike: true,
                previous: true,
                pauseplay: true,
                next: true,
                shuffle: true,
                repeat: true,
                share: true,
            },
        };

        this.settings = {};
        this.state = {
            song: null,
            liked: null,
            repeat: null,
            shuffle: null,
            elapsed: 0,
            elapsedBase: 0,
            duration: 0,
            playing: false,
            syncedAt: 0,
            connected: false,
        };

        this._container = null;
        this._observer = null;
        this._pollTimer = null;
        this._tickTimer = null;
        this._ws = null;
        this._wsRetry = null;
        this._afterAct = null;
        this._lastSig = '';
        this._injectQueued = false;
        this._wsState = 'idle';
    }

    start() {
        this.settings = Object.assign(
            {},
            this.defaults,
            BdApi.Data.load(this.meta.name, 'settings') || {},
        );
        this.settings.buttons = Object.assign(
            {},
            this.defaults.buttons,
            this.settings.buttons || {},
        );

        BdApi.DOM.addStyle(this.meta.name, this.css());

        this._container = document.createElement('div');
        this._container.className = 'ytmc-container';

        this._observer = new MutationObserver(() => this.queueInject());
        this._observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        this.inject();
        this.startConnection();
    }

    stop() {
        BdApi.DOM.removeStyle(this.meta.name);
        if (this._observer) this._observer.disconnect();
        this._observer = null;
        this.stopConnection();
        clearTimeout(this._afterAct);
        this._afterAct = null;
        if (this._container && this._container.parentElement)
            this._container.parentElement.removeChild(this._container);
        this._container = null;
    }

    save() {
        BdApi.Data.save(this.meta.name, 'settings', this.settings);
    }

    queueInject() {
        if (this._injectQueued) return;
        this._injectQueued = true;
        requestAnimationFrame(() => {
            this._injectQueued = false;
            this.inject();
        });
    }

    inject() {
        if (!this._container) return;
        if (document.body.contains(this._container)) return;
        const panel =
            document.querySelector('section[class*="panels_"]') ||
            document.querySelector('[class*="panels_"]');
        if (!panel) return;
        panel.insertBefore(this._container, panel.firstChild);
        this.render(true);
    }

    normalizedHost() {
        return (this.settings.host || 'localhost')
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '');
    }

    baseUrl() {
        return `http://${this.normalizedHost()}:${this.settings.port || 26538}`;
    }

    api(method, path, body) {
        const headers = {};
        if (this.settings.accessToken)
            headers.authorization = `Bearer ${this.settings.accessToken}`;
        const opts = { method, headers };
        if (body !== undefined) {
            headers['content-type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const url = this.baseUrl() + path;
        const useBd = !!(BdApi.Net && BdApi.Net.fetch);
        const doFetch = useBd
            ? BdApi.Net.fetch.bind(BdApi.Net)
            : window.fetch.bind(window);
        return doFetch(url, opts);
    }

    async apiJson(path) {
        try {
            const res = await this.api('GET', path);
            if (!res || res.status === 204) return null;
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    async authorize() {
        try {
            const res = await this.api(
                'POST',
                `/auth/${encodeURIComponent('betterdiscord')}`,
            );
            if (res && res.status === 200) {
                const data = await res.json();
                this.settings.accessToken = data.accessToken || '';
                this.save();
                this.toast('Authorized with YouTube Music', 'success');
                this.startConnection();
            } else if (res && res.status === 403) {
                this.toast(
                    'Authorization was denied in the YouTube Music app',
                    'error',
                );
            } else {
                this.toast(
                    `Authorization failed (${res ? res.status : 'no response'})`,
                    'error',
                );
            }
        } catch (e) {
            this.toast('Could not reach the API server', 'error');
        }
    }

    toast(content, type) {
        try {
            BdApi.UI.showToast(`[YT Music] ${content}`, {
                type: type || 'info',
            });
        } catch (e) {}
    }

    startConnection() {
        this.stopConnection();
        this.poll();
        this.setPollInterval(this.wsHealthy() ? 8000 : 3000);
        this._tickTimer = setInterval(() => this.tick(), 500);
        this.connectWs();
    }

    setPollInterval(ms) {
        clearInterval(this._pollTimer);
        this._pollTimer = setInterval(() => this.poll(), ms);
    }

    stopConnection() {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
        clearInterval(this._tickTimer);
        this._tickTimer = null;
        clearTimeout(this._wsRetry);
        this._wsRetry = null;
        if (this._ws) {
            try {
                this._ws.onclose = null;
                this._ws.onerror = null;
                this._ws.onmessage = null;
                this._ws.close();
            } catch (e) {}
            this._ws = null;
        }
    }

    wsHealthy() {
        return !!this._ws && this._ws.readyState === 1;
    }

    connectWs() {
        if (this._ws) return;
        const url = `ws://${this.normalizedHost()}:${this.settings.port || 26538}/api/v1/ws${this.settings.accessToken ? `?token=${encodeURIComponent(this.settings.accessToken)}` : ''}`;
        this._wsState = 'connecting';
        let ws;
        try {
            ws = new WebSocket(url);
        } catch (e) {
            this._wsState = 'error';
            return;
        }
        this._ws = ws;
        ws.onopen = () => {
            this._wsState = 'open';
            if (this._pollTimer) this.setPollInterval(8000);
        };
        ws.onmessage = (ev) => {
            let msg;
            try {
                msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : null;
            } catch (e) {
                return;
            }
            if (!msg) return;
            this.handleWsMessage(msg);
        };
        ws.onclose = () => {
            this._wsState = 'closed';
            if (this._ws === ws) this._ws = null;
            if (this._pollTimer) this.setPollInterval(3000);
            if (this._tickTimer) {
                clearTimeout(this._wsRetry);
                this._wsRetry = setTimeout(() => this.connectWs(), 5000);
            }
        };
        ws.onerror = () => {
            this._wsState = 'error';
            try {
                ws.close();
            } catch (err) {}
        };
    }

    handleWsMessage(msg) {
        if (!msg || !msg.type) return;
        const s = this.state;

        switch (msg.type) {
            case 'PLAYER_INFO':
            case 'VIDEO_CHANGED': {
                if (msg.song && msg.song.title) {
                    s.song = msg.song;
                    s.connected = true;
                    s.duration = Number(msg.song.songDuration) || 0;
                    s.playing =
                        msg.type === 'PLAYER_INFO'
                            ? !!msg.isPlaying
                            : !msg.song.isPaused;
                    this.setElapsed(
                        Number(
                            msg.position != null
                                ? msg.position
                                : msg.song.elapsedSeconds,
                        ) || 0,
                    );
                    if (typeof msg.repeat === 'string') s.repeat = msg.repeat;
                    if (typeof msg.shuffle === 'boolean')
                        s.shuffle = msg.shuffle;
                    this.render(true);
                }
                this.refreshLikeState();
                break;
            }
            case 'PLAYER_STATE_CHANGED': {
                s.elapsedBase = s.elapsed;
                s.syncedAt = Date.now();
                s.playing = !!msg.isPlaying;
                this.render();
                this.updateProgressOnly();
                break;
            }
            case 'POSITION_CHANGED': {
                if (typeof msg.position === 'number') {
                    this.setElapsed(msg.position);
                    this.updateProgressOnly();
                }
                break;
            }
            case 'REPEAT_CHANGED': {
                if (typeof msg.repeat === 'string') s.repeat = msg.repeat;
                this.render();
                break;
            }
            case 'SHUFFLE_CHANGED': {
                if (typeof msg.shuffle === 'boolean') s.shuffle = msg.shuffle;
                this.render();
                break;
            }
        }
    }

    setElapsed(pos) {
        pos = Math.max(0, Number(pos) || 0);
        this.state.elapsed = pos;
        this.state.elapsedBase = pos;
        this.state.syncedAt = Date.now();
    }

    async refreshLikeState() {
        const like = await this.apiJson('/api/v1/like-state');
        if (like && like.state !== this.state.liked) {
            this.state.liked = like.state;
            this.render();
        } else if (like) {
            this.state.liked = like.state;
        }
    }

    async poll() {
        const song = await this.apiJson('/api/v1/song');
        if (!song || !song.title) {
            const wasConnected = this.state.connected;
            this.state.song = null;
            this.state.connected = false;
            if (wasConnected) this.render(true);
            return;
        }

        this.state.song = song;
        this.state.connected = true;
        this.state.duration = Number(song.songDuration) || 0;
        if (typeof song.isPaused === 'boolean')
            this.state.playing = !song.isPaused;
        if (!this.wsHealthy())
            this.setElapsed(Number(song.elapsedSeconds) || 0);

        const jobs = [this.apiJson('/api/v1/like-state')];
        if (!this.wsHealthy())
            jobs.push(
                this.apiJson('/api/v1/repeat-mode'),
                this.apiJson('/api/v1/shuffle'),
            );
        const [like, repeat, shuffle] = await Promise.all(jobs);
        if (like) this.state.liked = like.state;
        if (repeat) this.state.repeat = repeat.mode;
        if (shuffle) this.state.shuffle = shuffle.state;
        this.render();
    }

    tick() {
        if (!this.state.connected || !this.state.playing) return;
        const now = Date.now();
        const elapsed =
            (Number(this.state.elapsedBase) || 0) +
            (now - this.state.syncedAt) / 1000;
        this.state.elapsed = Math.min(this.state.duration || Infinity, elapsed);
        this.updateProgressOnly();
    }

    act(method, path, body, optimistic) {
        if (typeof optimistic === 'function') optimistic();
        this.api(method, path, body).catch(() => {});
        clearTimeout(this._afterAct);
        this._afterAct = setTimeout(() => this.poll(), 350);
    }

    togglePlay() {
        this.act('POST', '/api/v1/toggle-play', undefined, () => {
            this.state.playing = !this.state.playing;
            this.setElapsed(this.state.elapsed);
            this.render();
        });
    }

    next() {
        this.act('POST', '/api/v1/next');
    }
    previous() {
        this.act('POST', '/api/v1/previous');
    }
    shuffle() {
        this.act('POST', '/api/v1/shuffle');
    }

    switchRepeat() {
        const order = ['NONE', 'ALL', 'ONE'];
        const cur = order.indexOf(this.state.repeat);
        this.act('POST', '/api/v1/switch-repeat', { iteration: 1 }, () => {
            this.state.repeat = order[(cur + 1) % order.length] || 'NONE';
            this.render();
        });
    }

    like() {
        const target = this.state.liked === 'LIKE' ? 'INDIFFERENT' : 'LIKE';
        this.act('POST', '/api/v1/like', undefined, () => {
            this.state.liked = target;
            this.render();
        });
    }

    dislike() {
        const target =
            this.state.liked === 'DISLIKE' ? 'INDIFFERENT' : 'DISLIKE';
        this.act('POST', '/api/v1/dislike', undefined, () => {
            this.state.liked = target;
            this.render();
        });
    }

    seekTo(seconds) {
        seconds = Math.max(
            0,
            Math.min(this.state.duration, Math.round(seconds)),
        );
        this.act('POST', '/api/v1/seek-to', { seconds }, () => {
            this.setElapsed(seconds);
            this.updateProgressOnly();
        });
    }

    copyUrl() {
        const s = this.state.song;
        const url =
            s &&
            (s.url ||
                (s.videoId
                    ? `https://music.youtube.com/watch?v=${s.videoId}`
                    : ''));
        if (url) {
            try {
                DiscordNative.clipboard.copy(url);
            } catch (e) {
                try {
                    navigator.clipboard.writeText(url);
                } catch (e2) {}
            }
            this.toast('Song URL copied', 'success');
        } else this.toast('No URL available', 'error');
    }

    fmt(t) {
        t = Math.max(0, Math.floor(t || 0));
        const s = t % 60,
            m = Math.floor(t / 60) % 60,
            h = Math.floor(t / 3600);
        const pad = (n) => (n < 10 ? '0' + n : '' + n);
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    signature() {
        const s = this.state;
        return JSON.stringify([
            s.connected,
            s.song && s.song.videoId,
            s.song && s.song.title,
            s.playing,
            s.liked,
            s.repeat,
            s.shuffle,
            JSON.stringify(this.settings.buttons),
            this.settings.addTimeline,
        ]);
    }

    render(force) {
        if (!this._container) return;
        if (!this.state.connected || !this.state.song) {
            this._container.innerHTML = '';
            this._container.classList.remove('ytmc-visible');
            this._lastSig = '';
            return;
        }
        const sig = this.signature();
        if (!force && sig === this._lastSig) {
            this.updateProgressOnly();
            return;
        }
        this._lastSig = sig;

        const s = this.state.song;
        const b = this.settings.buttons;

        this._container.classList.add('ytmc-visible');

        const cover = s.imageSrc
            ? `<img class="ytmc-cover" src="${this.escapeHtml(s.imageSrc)}" alt="">`
            : `<div class="ytmc-cover ytmc-cover-fallback">${this.icon('note')}</div>`;

        const btn = (key, title, svg, cls) => {
            if (!b[key]) return '';
            return `<button class="ytmc-btn ${cls || ''}" data-act="${key}" title="${this.escapeHtml(title)}" aria-label="${this.escapeHtml(title)}">${svg}</button>`;
        };

        const playIcon = this.state.playing
            ? this.icon('pause')
            : this.icon('play');
        const repeatActive = this.state.repeat && this.state.repeat !== 'NONE';
        const repeatIcon =
            this.state.repeat === 'ONE'
                ? this.icon('repeatOne')
                : this.icon('repeat');

        const buttonsRow = `
			<div class="ytmc-buttons">
				${btn('dislike', 'Dislike', this.icon('thumbDown'), this.state.liked === 'DISLIKE' ? 'ytmc-active' : '')}
				${btn('previous', 'Previous', this.icon('previous'))}
				${btn('pauseplay', this.state.playing ? 'Pause' : 'Play', playIcon, 'ytmc-primary')}
				${btn('next', 'Next', this.icon('next'))}
				${btn('like', 'Like', this.icon('thumbUp'), this.state.liked === 'LIKE' ? 'ytmc-active' : '')}
				${btn('shuffle', 'Shuffle', this.icon('shuffle'), this.state.shuffle ? 'ytmc-active' : '')}
				${btn('repeat', 'Repeat: ' + (this.state.repeat || 'NONE'), repeatIcon, repeatActive ? 'ytmc-active' : '')}
			</div>`;

        const pct = this.state.duration
            ? (this.state.elapsed / this.state.duration) * 100
            : 0;
        const timeline = this.settings.addTimeline
            ? `
			<div class="ytmc-timeline">
				<div class="ytmc-bar" data-act="seek">
					<div class="ytmc-bar-fill" style="width:${pct}%"></div>
					<div class="ytmc-bar-grabber" style="left:${pct}%"></div>
				</div>
				<div class="ytmc-bar-text">
					<span class="ytmc-cur">${this.fmt(this.state.elapsed)}</span>
					<span class="ytmc-dur">${this.fmt(this.state.duration)}</span>
				</div>
			</div>`
            : '';

        this._container.innerHTML = `
			<div class="ytmc-inner">
				<div class="ytmc-cover-wrap">${cover}</div>
				<div class="ytmc-details">
					<div class="ytmc-title">${this.escapeHtml(s.title || '')}</div>
					<div class="ytmc-artist">${this.escapeHtml([s.artist, s.album].filter(Boolean).join(' — '))}</div>
				</div>
				${btn('share', 'Copy song URL', this.icon('share'))}
			</div>
			${buttonsRow}
			${timeline}
		`;

        this.bindEvents();
    }

    bindEvents() {
        const c = this._container;
        if (!c) return;

        c.querySelectorAll('[data-act]').forEach((el) => {
            const act = el.getAttribute('data-act');
            if (act === 'seek') {
                el.addEventListener('click', (e) => {
                    const r = el.getBoundingClientRect();
                    const frac = Math.max(
                        0,
                        Math.min(1, (e.clientX - r.left) / r.width),
                    );
                    this.seekTo(frac * this.state.duration);
                });
                return;
            }
            el.addEventListener('click', (e) => {
                e.preventDefault();
                switch (act) {
                    case 'pauseplay':
                        this.togglePlay();
                        break;
                    case 'next':
                        this.next();
                        break;
                    case 'previous':
                        this.previous();
                        break;
                    case 'shuffle':
                        this.shuffle();
                        break;
                    case 'repeat':
                        this.switchRepeat();
                        break;
                    case 'like':
                        this.like();
                        break;
                    case 'dislike':
                        this.dislike();
                        break;
                    case 'share':
                        this.copyUrl();
                        break;
                }
            });
        });
    }

    updateProgressOnly() {
        const c = this._container;
        if (!c || !c.classList.contains('ytmc-visible')) return;
        const pct = this.state.duration
            ? (this.state.elapsed / this.state.duration) * 100
            : 0;
        const fill = c.querySelector('.ytmc-bar-fill');
        const grab = c.querySelector('.ytmc-bar-grabber');
        const cur = c.querySelector('.ytmc-cur');
        if (fill) fill.style.width = pct + '%';
        if (grab) grab.style.left = pct + '%';
        if (cur) cur.textContent = this.fmt(this.state.elapsed);
    }

    authRowComponent() {
        const self = this;
        const R = BdApi.React;
        const Button = BdApi.Components.Button;

        return function YtmcAuthRow() {
            const [busy, setBusy] = R.useState(false);
            const [hint, setHint] = R.useState(
                self.settings.accessToken
                    ? 'Token stored. Re-authorize if requests start failing.'
                    : 'No token. Click Authorize and confirm the prompt in the YouTube Music app.',
            );

            const doAuthorize = async () => {
                setBusy(true);
                await self.authorize();
                setHint(
                    self.settings.accessToken
                        ? 'Token stored.'
                        : 'Authorization failed.',
                );
                setBusy(false);
            };

            const doTest = async () => {
                const res = await self
                    .api('GET', '/api/v1/song')
                    .catch(() => null);
                const wsMsg = ` · WebSocket: ${self._wsState}`;
                if (res && res.ok) {
                    const song = await res.json().catch(() => null);
                    self.toast(
                        `REST OK${song && song.title ? ` — ${song.title}` : ' (nothing playing)'}${wsMsg}`,
                        'success',
                    );
                } else if (res && res.status === 204)
                    self.toast(`REST OK (nothing playing)${wsMsg}`, 'info');
                else if (res && res.status === 401)
                    self.toast(
                        `REST reachable but not authorized — click Authorize${wsMsg}`,
                        'error',
                    );
                else
                    self.toast(
                        `Could not reach the API server at ${self.baseUrl()}${wsMsg}`,
                        'error',
                    );
            };

            const doClear = () => {
                self.settings.accessToken = '';
                self.save();
                self.startConnection();
                setHint('Token cleared.');
            };

            return R.createElement(
                'div',
                { className: 'ytmc-auth-row' },
                R.createElement('span', { className: 'ytmc-auth-hint' }, hint),
                R.createElement(
                    Button,
                    {
                        size: Button.Sizes.SMALL,
                        disabled: busy,
                        onClick: doAuthorize,
                    },
                    'Authorize',
                ),
                R.createElement(
                    Button,
                    {
                        size: Button.Sizes.SMALL,
                        look: Button.Looks.OUTLINED,
                        onClick: doTest,
                    },
                    'Test connection',
                ),
                R.createElement(
                    Button,
                    {
                        size: Button.Sizes.SMALL,
                        look: Button.Looks.OUTLINED,
                        color: Button.Colors.RED,
                        onClick: doClear,
                    },
                    'Clear token',
                ),
            );
        };
    }

    getSettingsPanel() {
        const R = BdApi.React;
        const s = this.settings;

        const buttonNames = {
            like: 'Like',
            dislike: 'Dislike',
            previous: 'Previous',
            pauseplay: 'Play/Pause',
            next: 'Next',
            shuffle: 'Shuffle',
            repeat: 'Repeat',
            share: 'Share',
        };

        const buttonSettings = Object.keys(this.defaults.buttons).map(
            (key) => ({
                type: 'switch',
                id: `button-${key}`,
                name: buttonNames[key] || key,
                value: !!s.buttons[key],
            }),
        );

        const settings = [
            {
                type: 'text',
                id: 'host',
                name: 'Host',
                note: 'Hostname of the YouTube Music API server',
                value: s.host,
            },
            {
                type: 'text',
                id: 'port',
                name: 'Port',
                note: 'Default is 26538',
                value: String(s.port),
            },
            {
                type: 'custom',
                id: 'authorization',
                name: 'Authorization',
                value: null,
                children: R.createElement(this.authRowComponent()),
            },
            {
                type: 'switch',
                id: 'addTimeline',
                name: 'Show timeline',
                note: 'Progress bar with seek support',
                value: s.addTimeline,
            },
            {
                type: 'category',
                id: 'buttons',
                name: 'Buttons',
                collapsible: false,
                settings: buttonSettings,
            },
        ];

        return BdApi.UI.buildSettingsPanel({
            settings,
            onChange: (_categoryId, id, value) => {
                if (id.startsWith('button-')) {
                    this.settings.buttons[id.slice(7)] = value;
                    this.save();
                    this.render(true);
                    return;
                }
                if (id === 'host') {
                    this.settings[id] = String(value).trim();
                    this.save();
                    this.startConnection();
                    return;
                }
                if (id === 'port') {
                    this.settings.port =
                        String(value).trim() || this.defaults.port;
                    this.save();
                    this.startConnection();
                    return;
                }
                this.settings[id] = value;
                this.save();
                this.render(true);
            },
        });
    }

    escapeHtml(str) {
        return String(str == null ? '' : str).replace(
            /[&<>"']/g,
            (c) =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                })[c],
        );
    }

    icon(name) {
        const p =
            {
                play: 'M8 5v14l11-7z',
                pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
                previous: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
                next: 'M16 6h2v12h-2zM6 6l8.5 6L6 18z',
                shuffle:
                    'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
                repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
                repeatOne:
                    'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-2.5-1V9.5h-1l-1.5.75v1.05l1.25-.6V16z',
                thumbUp:
                    'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z',
                thumbDown:
                    'M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z',
                share: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
                note: 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z',
            }[name] || '';
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${p}"/></svg>`;
    }

    css() {
        return `
			.ytmc-container {
				/* white text/icons, blue when active */
				--ytmc-fg: #ffffff;
				--ytmc-fg-dim: rgba(255, 255, 255, 0.72);
				--ytmc-accent: #4a9eff;
				display: none;
			}
			.ytmc-container.ytmc-visible {
				display: flex;
				flex-direction: column;
				justify-content: center;
				min-height: 52px;
				padding: 8px;
				box-sizing: border-box;
				border-bottom: 1px solid var(--background-modifier-accent);
				border-radius: var(--radius-sm, 4px) var(--radius-sm, 4px) 0 0;
				/* transparent by default so it inherits the panel's themed surface */
				background: transparent;
				overflow: hidden;
				order: -1;
			}
			/* match SpotifyControls: faint overlay tint that adapts to light/dark + custom themes */
			.theme-light .ytmc-container.ytmc-visible { background: var(--bg-overlay-3, rgba(0, 0, 0, 0.04)); }
			.theme-dark .ytmc-container.ytmc-visible { background: var(--bg-overlay-1, rgba(255, 255, 255, 0.04)); }
			.ytmc-inner { display: flex; align-items: center; width: 100%; font-size: 14px; gap: 8px; }
			.ytmc-inner > .ytmc-btn { flex: 0 0 auto; }

			.ytmc-cover-wrap {
				position: relative; width: 44px; min-width: 44px; height: 44px;
				border-radius: 4px; overflow: hidden;
			}
			.ytmc-cover { display: block; width: 100%; height: 100%; object-fit: cover; }
			.ytmc-cover-fallback {
				display: flex; align-items: center; justify-content: center;
				width: 100%; height: 100%; background: var(--background-tertiary); color: var(--text-muted);
			}

			.ytmc-details { flex: 1 1 auto; min-width: 0; user-select: text; }
			.ytmc-title {
				font-weight: 600; color: var(--ytmc-fg);
				white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
			}
			.ytmc-artist {
				font-size: 12px; color: var(--ytmc-fg-dim);
				white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 15px;
			}

			.ytmc-buttons {
				display: flex; align-items: center; flex-wrap: wrap;
				justify-content: space-between; gap: 2px; margin-top: 4px;
			}
			.ytmc-btn {
				display: flex; align-items: center; justify-content: center;
				width: 28px; height: 28px; padding: 0; border: 0; border-radius: 4px;
				background: transparent; color: var(--ytmc-fg); cursor: pointer;
			}
			.ytmc-btn:hover { color: var(--ytmc-fg); background: rgba(255, 255, 255, 0.12); }
			.ytmc-btn.ytmc-active { color: var(--ytmc-accent); }
			.ytmc-btn.ytmc-active:hover { color: var(--ytmc-accent); }
			.ytmc-btn.ytmc-primary { color: var(--ytmc-fg); }

			.ytmc-timeline { margin: 6px 0 2px; }
			.ytmc-bar {
				position: relative; height: 4px; border-radius: 2px;
				background: var(--background-modifier-accent); cursor: pointer;
			}
			.ytmc-bar-fill { height: 100%; border-radius: 2px; background: var(--ytmc-fg); min-width: 2px; }
			.ytmc-timeline:hover .ytmc-bar-fill { background: var(--ytmc-accent); }
			.ytmc-bar-grabber {
				position: absolute; top: 50%; width: 12px; height: 12px; margin-left: -6px;
				border-radius: 50%; background: var(--ytmc-fg); transform: translateY(-50%);
				opacity: 0; transition: opacity .15s ease;
			}
			.ytmc-timeline:hover .ytmc-bar-grabber { opacity: 1; }
			.ytmc-bar-text { display: flex; justify-content: space-between; font-size: 10px; color: var(--ytmc-fg-dim); margin-top: 3px; }

			.ytmc-auth-row { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
			.ytmc-auth-hint { font-size: 12px; color: var(--text-muted); margin-right: auto; }
		`;
    }
};
