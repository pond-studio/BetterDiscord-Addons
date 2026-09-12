/**
 * @name CompactVoicePanel
 * @author voyhel
 * @authorId 496360025099337728
 * @version 1.0.0
 * @description Hides the voice panel buttons.
 */

const css = `
	[class*="actionButtons_e131a9"] {
		position: fixed !important;
		opacity: 0 !important;
		pointer-events: none !important;
		z-index: 0 !important;
		margin: 0 !important;
		padding: 0 !important;
	}
`;

const SCREEN_SHARE_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5v2h2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h2v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm8 3a1 1 0 0 1 .7.3l3 3a1 1 0 0 1-1.4 1.4L13 11.4V15a1 1 0 1 1-2 0v-3.6l-1.3 1.3a1 1 0 0 1-1.4-1.4l3-3A1 1 0 0 1 12 7Z"/></svg>`;

module.exports = class CompactVoicePanel {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        BdApi.DOM.addStyle(this.meta.name, css);
        this._voiceObserver = new MutationObserver(() => {
            if (this._voiceQueued) return;
            this._voiceQueued = true;
            this._voiceRaf = requestAnimationFrame(() => {
                this._voiceQueued = false;
                this._voiceRaf = null;
                this.injectStreamButton();
                this.parkActionButtons();
            });
        });
        this._voiceObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
        this.injectStreamButton();
    }

    stop() {
        BdApi.DOM.removeStyle(this.meta.name);
        if (this._voiceObserver) this._voiceObserver.disconnect();
        this._voiceObserver = null;
        if (this._voiceRaf) cancelAnimationFrame(this._voiceRaf);
        this._voiceRaf = null;
        this.removeStreamButton();
    }

    injectStreamButton() {
        const container = document.querySelector(
            '[class*="voiceButtonsContainer_e131a9"]',
        );
        if (!container || container.querySelector('.hb-stream-btn')) return;
        const disconnect =
            container.querySelector('button[aria-label="Disconnect"]') ||
            container.querySelector('button:last-of-type');
        if (!disconnect) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = disconnect.className + ' hb-stream-btn';
        btn.setAttribute('aria-label', 'Share Your Screen');
        btn.title = 'Share Your Screen';

        const contents = document.createElement('div');
        contents.className = disconnect.firstElementChild
            ? disconnect.firstElementChild.className
            : '';
        const iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'display:flex;width:20px;height:20px';
        iconWrap.innerHTML = SCREEN_SHARE_SVG;
        contents.appendChild(iconWrap);
        btn.appendChild(contents);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.triggerShareScreen();
        });

        container.insertBefore(btn, disconnect);
        this.parkActionButtons();
    }

    parkActionButtons() {
        const row = document.querySelector('[class*="actionButtons_e131a9"]');
        const btn = document.querySelector('.hb-stream-btn');
        if (!row || !btn) return;
        const r = btn.getBoundingClientRect();
        if (!r.width && !r.height) return;
        row.style.top = r.top + 'px';
        row.style.left = r.left + 'px';
        row.style.width = r.width + 'px';
        row.style.height = r.height + 'px';
    }

    unparkActionButtons() {
        document
            .querySelectorAll('[class*="actionButtons_e131a9"]')
            .forEach((row) => {
                row.style.top =
                    row.style.left =
                    row.style.width =
                    row.style.height =
                        '';
            });
    }

    removeStreamButton() {
        document.querySelectorAll('.hb-stream-btn').forEach((n) => n.remove());
        this.unparkActionButtons();
    }

    triggerShareScreen() {
        this.parkActionButtons();
        let target = null;
        for (const b of document.querySelectorAll(
            '[class*="actionButtons_e131a9"] button',
        )) {
            const id = b.getAttribute('aria-describedby');
            const described = id && document.getElementById(id);
            const label =
                (b.getAttribute('aria-label') || '') +
                ' ' +
                (described ? described.textContent : '');
            if (/share your screen|go live|stop streaming/i.test(label)) {
                target = b;
                break;
            }
        }
        if (target) target.click();
        else
            BdApi.UI.showToast('Could not find the Screen Share button', {
                type: 'error',
            });
    }
};
