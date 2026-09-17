/**
 * @name toggleChannelList
 * @author voyhel
 * @authorId 496360025099337728
 * @version 1.0.1
 * @description Clicking the sidebar handle toggles the sidebar visibility.
 * @source https://github.com/pond-studio/BetterDiscord-Addons/blob/main/Plugins/toggleChannelList.js
 * @updateUrl https://raw.githubusercontent.com/pond-studio/BetterDiscord-Addons/refs/heads/main/Plugins/toggleChannelList.plugin.js
 */

module.exports = class SidebarClickToggle {
    constructor(meta) {
        this.meta = meta;
        this.clickState = null;
    }

    start() {
        BdApi.DOM.addStyle(
            this.meta.name,
            `
			.sidebarCollapsed {
				display: none !important;
			}
			body.userPanelCollapsed .container__37e49 .nameTag__37e49,
			body.userPanelCollapsed .container__37e49 .buttons__37e49 {
				display: none !important;
			}
		`,
        );

        this.onMouseDown = (e) => {
            const separator = e.target.closest(
                '[role="separator"][aria-label="Resize Sidebar"]',
            );
            if (!separator) return;
            this.clickState = {
                separator,
                startX: e.clientX,
                startY: e.clientY,
                moved: false,
            };
        };
        this.onMouseMove = (e) => {
            if (!this.clickState) return;
            const dx = Math.abs(e.clientX - this.clickState.startX);
            const dy = Math.abs(e.clientY - this.clickState.startY);
            if (dx > 3 || dy > 3) this.clickState.moved = true;
        };
        this.onMouseUp = () => {
            if (!this.clickState) return;
            const { separator, moved } = this.clickState;
            this.clickState = null;
            if (moved) return;
            const container = separator.previousElementSibling;
            if (!container) return;
            const collapsed = container.classList.toggle('sidebarCollapsed');
            document.body.classList.toggle('userPanelCollapsed', collapsed);
        };

        document.addEventListener('mousedown', this.onMouseDown, true);
        document.addEventListener('mousemove', this.onMouseMove, true);
        document.addEventListener('mouseup', this.onMouseUp, true);
    }

    stop() {
        document.body.classList.remove('userPanelCollapsed');
        document.removeEventListener('mousedown', this.onMouseDown, true);
        document.removeEventListener('mousemove', this.onMouseMove, true);
        document.removeEventListener('mouseup', this.onMouseUp, true);
        document
            .querySelectorAll('.sidebarCollapsed')
            .forEach((el) => el.classList.remove('sidebarCollapsed'));
        this.clickState = null;
        BdApi.DOM.removeStyle(this.meta.name);
    }
};
