/**
 * @name HideButtons
 * @author voyhel
 * @authorId 496360025099337728
 * @version 1.0.1
 * @description Toggleable options to hide various buttons around the Discord UI
 * @source https://github.com/pond-studio/BetterDiscord-Addons/blob/main/Plugins/HideButtons.plugin.js
 * @updateUrl https://raw.githubusercontent.com/pond-studio/BetterDiscord-Addons/refs/heads/main/Plugins/HideButtons.plugin.js
 */

module.exports = class HideButtons {
    constructor(meta) {
        this.meta = meta;

        this.tweaks = [
            {
                id: 'hideNitroHome',
                name: 'Hide Nitro Home',
                note: 'Hides Discord Nitro Home from the sidebar and UI',
                value: false,
                css: hideNavLinkCss('/store', '___nitro'),
            },
            {
                id: 'hideQuests',
                name: 'Hide Quests',
                note: 'Hides Discord Quests from the sidebar and UI',
                value: false,
                css: hideNavLinkCss('/quest-home', '___quests'),
            },
            {
                id: 'hideShop',
                name: 'Hide Shop',
                note: 'Hides Discord Shop from the DM sidebar',
                value: false,
                css: hideNavLinkCss('/shop', '___shop'),
            },
            {
                id: 'hideBoostGoal',
                name: 'Hide Server Boost Goal',
                note: 'Hides the Boost Goal card shown in server sidebars',
                value: false,
                css: `
					div[role="button"][tabindex="0"]:has([class*="boostCountText"]) {
						display: none !important;
					}
					[class*="containerWithMargin"]:has([class*="boostCountText"]) {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideAddServerButton',
                name: 'Hide Add a Server Button',
                note: 'Hides the Add a Server button and its tutorial tooltip from the server list',
                value: false,
                css: `
					.circleIconButton__5bc7e[data-list-item-id="guildsnav___create-join-button"] {
						display: none !important;
					}
					.tutorialContainer__650eb {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideDiscoverButton',
                name: 'Hide Discover Button',
                note: 'Hides the Discover button from the server list',
                value: false,
                css: `
					.listItem__650eb:has(.circleIconButton__5bc7e.discoveryIcon_ef3116[data-list-item-id="guildsnav___guild-discover-button"]) {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideVideoCallButton',
                name: 'Hide Video Call Button',
                note: 'Hides the Start Video Call button',
                value: false,
                css: `
					.iconWrapper__9293f[aria-label="Start Video Call"] {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideGiftButton',
                name: 'Hide Gift Button',
                note: 'Hides the Give a Gift button in the chat input bar',
                value: false,
                css: hideAriaWithContainer(
                    'Give a Gift',
                    'div.container__5287f',
                ),
            },
            {
                id: 'hideStickerButton',
                name: 'Hide Sticker Picker Button',
                note: 'Hides the Open sticker picker button in the chat input bar',
                value: false,
                css: `
					.stickerButton__74017 {
						display: none !important;
					}
					[aria-label="Open sticker picker"] {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideGifButton',
                name: 'Hide GIF Picker Button',
                note: 'Hides the Open GIF picker button in the chat input bar',
                value: false,
                css: hideAriaWithContainer(
                    'Open GIF picker',
                    'div.buttonContainer__74017',
                ),
            },
            {
                id: 'hideAppsButton',
                name: 'Hide Apps Button',
                note: 'Hides the Apps button in the chat input bar',
                value: false,
                css: `
					.button_e6e74f[aria-label="Apps"] {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideInboxButton',
                name: 'Hide Inbox Button',
                note: 'Hides the Inbox button in the top bar',
                value: false,
                css: `
					.clickable__81391[aria-label="Inbox"] {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideHelpButton',
                name: 'Hide Help Button',
                note: 'Hides the Help button in the top bar',
                value: false,
                css: `
					.clickable__81391[aria-label="Help"] {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideBackForwardButtons',
                name: 'Hide Back/Forward Buttons',
                note: 'Hides the navigation back and forward buttons in the top bar',
                value: false,
                css: `
					.backForwardButtons__63abb {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideMuteButton',
                name: 'Hide Mute Button',
                note: 'Hides the Mute button and its Input Options chevron in the bottom user bar',
                value: false,
                css: hideAudioButtonCss(['Mute', 'Unmute']),
            },
            {
                id: 'hideDeafenButton',
                name: 'Hide Deafen Button',
                note: 'Hides the Deafen button and its Output Options chevron in the bottom user bar',
                value: false,
                css: hideAudioButtonCss(['Deafen', 'Undeafen']),
            },
            {
                id: 'hideNoiseSuppressionButton',
                name: 'Hide Noise Suppression Button',
                note: 'Hides the Noise Suppression (Krisp) button in the bottom user bar',
                value: false,
                css: `
					button[aria-label^="Noise Suppression"] {
						display: none !important;
					}
				`,
            },
            {
                id: 'hideActivityPanel',
                name: 'Hide Activity Panel',
                note: 'Hides the activity / rich presence panel above the account panel',
                value: false,
                css: `
					[class*="activityPanel_"] {
						display: none !important;
					}
				`,
            },
        ];
    }

    loadSettings() {
        const saved = BdApi.Data.load(this.meta.name, 'settings') || {};
        for (const tweak of this.tweaks) {
            if (typeof saved[tweak.id] === 'boolean')
                tweak.value = saved[tweak.id];
        }
    }

    saveSettings() {
        const toSave = {};
        for (const tweak of this.tweaks) toSave[tweak.id] = tweak.value;
        BdApi.Data.save(this.meta.name, 'settings', toSave);
    }

    applyCss() {
        const css = [
            passiveCss,
            ...this.tweaks.filter((t) => t.value).map((t) => t.css),
        ].join('\n');
        BdApi.DOM.removeStyle(this.meta.name);
        BdApi.DOM.addStyle(this.meta.name, css);
    }

    start() {
        this.loadSettings();
        this.applyCss();
    }

    stop() {
        BdApi.DOM.removeStyle(this.meta.name);
    }

    getSettingsPanel() {
        const settings = this.tweaks.map((tweak) => ({
            type: 'switch',
            id: tweak.id,
            name: tweak.name,
            note: tweak.note,
            value: tweak.value,
        }));

        return BdApi.UI.buildSettingsPanel({
            settings: settings,
            onChange: (_category, id, value) => {
                const tweak = this.tweaks.find((t) => t.id === id);
                if (!tweak) return;
                tweak.value = value;
                this.saveSettings();
                this.applyCss();
            },
        });
    }
};

function hideNavLinkCss(href, listItemIdFragment) {
    return `
		a[href="${href}"],
		a[data-list-item-id*="${listItemIdFragment}"],
		a.link__972a0[href="${href}"] {
			display: none !important;
		}
		li:has(a[href="${href}"]),
		li:has(a[data-list-item-id*="${listItemIdFragment}"]),
		div:has(> li:has(a[href="${href}"])),
		div:has(> li:has(a[data-list-item-id*="${listItemIdFragment}"])),
		div.wrapper__553bf:has(a[href="${href}"]),
		div.wrapper__553bf:has(a[data-list-item-id*="${listItemIdFragment}"]),
		div.interactive__972a0:has(a[href="${href}"]),
		div.container_e45859:has(a[href="${href}"]) {
			display: none !important;
		}

		li.channel__972a0:empty,
		div.container_e45859:empty,
		div.wrapper__553bf:empty {
			display: none !important;
			margin: 0 !important;
			padding: 0 !important;
			height: 0 !important;
			min-height: 0 !important;
		}

		a[href="${href}"],
		li:has(a[href="${href}"]) {
			animation: none !important;
			transition: none !important;
		}
	`;
}

function hideAriaWithContainer(label, containerSelector) {
    return `
		[aria-label="${label}"] {
			display: none !important;
		}
		${containerSelector}:has([aria-label="${label}"]) {
			display: none !important;
		}
	`;
}

function hideAudioButtonCss(labels) {
    const selectors = labels.map(
        (label) =>
            `.audioButtonParent__5e764:has(button[aria-label="${label}"])`,
    );
    return `
		${selectors.join(',\n\t\t')} {
			display: none !important;
		}
	`;
}

const passiveCss = `
	.sectionDivider_e6b769 {
		margin-top: 0 !important;
	}
`;
