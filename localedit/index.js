(() => {
    const v = typeof vendetta !== "undefined" ? vendetta : (window.vendetta || window.bunny || {});
    const metro = v.metro || {};
    const common = metro.common || {};
    const patcher = v.patcher || {};
    const ui = v.ui || {};
    const utils = v.utils || {};

    const findByProps = metro.findByProps;
    const findByStoreName = metro.findByStoreName;
    const FluxDispatcher = common.FluxDispatcher;
    const React = common.React;
    const before = patcher.before;
    const after = patcher.after;
    const getAssetIDByName = ui.assets ? ui.assets.getAssetIDByName : null;
    const Forms = ui.components ? ui.components.Forms : {};
    const ActionSheetRow = (findByProps && findByProps("ActionSheetRow") && findByProps("ActionSheetRow").ActionSheetRow) || Forms.FormRow;
    const findInReactTree = utils.findInReactTree;

    const LazyActionSheet = findByProps ? findByProps("openLazy", "hideActionSheet") : null;
    const MessageStore = findByStoreName ? findByStoreName("MessageStore") : null;
    const UserStore = findByStoreName ? findByStoreName("UserStore") : null;
    const Messages = findByProps ? (findByProps("editMessage", "deleteMessage") || findByProps("startEditMessage", "editMessage") || findByProps("sendMessage")) : null;

    const edits = new Map();
    let isEditing = false;
    let patches = [];

    return {
        onLoad: function () {
            if (!LazyActionSheet) return;

            patches.push(before("openLazy", LazyActionSheet, function (args) {
                const component = args[0];
                const key = args[1];
                var msg = args[2];
                var message = msg && msg.message;
                if (key !== "MessageLongPressActionSheet" || !message) return;

                component.then(function (instance) {
                    var unpatch = after("default", instance, function (_, res) {
                        setTimeout(unpatch, 0);

                        var buttons = findInReactTree(res, function (x) {
                            return Array.isArray(x) && x.some(function (b) {
                                return b && b.props && (b.props.label || b.props.message);
                            });
                        });
                        if (!buttons) return;

                        var currentUser = UserStore ? UserStore.getCurrentUser() : null;
                        var currentMessage = (MessageStore ? MessageStore.getMessage(message.channel_id, message.id) : null) || message;

                        if (currentUser && currentMessage.author && currentMessage.author.id === currentUser.id) return;
                        if (buttons.some(function (b) { return b && b.props && b.props.label === "Edit Locally"; })) return;

                        var position = buttons.findIndex(function (x) {
                            var lbl = (x && x.props && x.props.label && x.props.label.toLowerCase()) || "";
                            var msgProp = (x && x.props && typeof x.props.message === "string") ? x.props.message.toLowerCase() : "";
                            return lbl.indexOf("mark unread") !== -1 || msgProp.indexOf("mark_unread") !== -1;
                        });

                        if (position === -1) position = 0;

                        var handleEdit = function () {
                            isEditing = true;
                            if (!edits.has(currentMessage.id)) {
                                edits.set(currentMessage.id, JSON.parse(JSON.stringify(currentMessage)));
                            }
                            LazyActionSheet.hideActionSheet();

                            if (Messages && Messages.startEditMessage) {
                                Messages.startEditMessage(currentMessage.channel_id, currentMessage.id, currentMessage.content);
                            } else if (FluxDispatcher) {
                                FluxDispatcher.dispatch({
                                    type: "MESSAGE_START_EDIT",
                                    channelId: currentMessage.channel_id,
                                    messageId: currentMessage.id,
                                    content: currentMessage.content
                                });
                            }
                        };

                        var iconId = getAssetIDByName ? (getAssetIDByName("ic_edit_24px") || getAssetIDByName("edit")) : null;
                        var iconElement = (ActionSheetRow && ActionSheetRow.Icon && React) ? React.createElement(ActionSheetRow.Icon, { source: iconId }) : null;
                        var editButton = React ? React.createElement(ActionSheetRow, {
                            label: "Edit Locally",
                            icon: iconElement,
                            onPress: handleEdit
                        }) : null;

                        if (editButton) {
                            buttons.splice(position, 0, editButton);
                        }
                    });
                });
            }));

            if (Messages) {
                patches.push(before("editMessage", Messages, function (args) {
                    var channelId = args[0];
                    var messageId = args[1];
                    var message = args[2];

                    if (isEditing) {
                        var baseMessage = edits.get(messageId);
                        if (!baseMessage) return;

                        if (FluxDispatcher) {
                            FluxDispatcher.dispatch({
                                type: "MESSAGE_UPDATE",
                                message: Object.assign({}, baseMessage, {
                                    content: message.content,
                                    edited_timestamp: null
                                }),
                                otherPluginBypass: true
                            });
                        }
                        return false;
                    }
                }));

                if (Messages.endEditMessage) {
                    patches.push(after("endEditMessage", Messages, function () {
                        if (isEditing) {
                            isEditing = false;
                        }
                    }));
                }
            }
        },

        onUnload: function () {
            patches.forEach(function (p) { if (typeof p === "function") p(); });
            patches = [];
            edits.clear();
        }
    };
})();
