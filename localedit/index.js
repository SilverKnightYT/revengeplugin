import { findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, React } from "@vendetta/metro/common";
import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";
import { findInReactTree } from "@vendetta/utils";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const ActionSheetRow = findByProps("ActionSheetRow")?.ActionSheetRow ?? Forms.FormRow;
const MessageStore = findByStoreName("MessageStore");
const UserStore = findByStoreName("UserStore");
const Messages = findByProps("editMessage", "deleteMessage") ?? findByProps("startEditMessage", "editMessage") ?? findByProps("sendMessage");

const edits = new Map();
let isEditing = false;
let patches = [];

export default {
    onLoad() {
        if (!LazyActionSheet) return;

        patches.push(before("openLazy", LazyActionSheet, ([component, key, msg]) => {
            const message = msg?.message;
            if (key !== "MessageLongPressActionSheet" || !message) return;

            component.then((instance) => {
                const unpatch = after("default", instance, (_, res) => {
                    setTimeout(unpatch, 0);

                    const buttons = findInReactTree(res, (x) => Array.isArray(x) && x.some((b) => b?.props?.label || b?.props?.message));
                    if (!buttons) return;

                    const currentUser = UserStore.getCurrentUser();
                    const currentMessage = MessageStore.getMessage(message.channel_id, message.id) ?? message;

                    if (currentUser && currentMessage.author?.id === currentUser.id) return;
                    if (buttons.some((b) => b?.props?.label === "Edit Locally")) return;

                    let position = buttons.findIndex((x) => {
                        const lbl = x?.props?.label?.toLowerCase() || "";
                        const msgProp = typeof x?.props?.message === "string" ? x.props.message.toLowerCase() : "";
                        return lbl.includes("mark unread") || msgProp.includes("mark_unread");
                    });

                    if (position === -1) position = 0;

                    const handleEdit = () => {
                        isEditing = true;
                        if (!edits.has(currentMessage.id)) {
                            edits.set(currentMessage.id, JSON.parse(JSON.stringify(currentMessage)));
                        }
                        LazyActionSheet.hideActionSheet();

                        if (Messages?.startEditMessage) {
                            Messages.startEditMessage(currentMessage.channel_id, currentMessage.id, currentMessage.content);
                        } else {
                            FluxDispatcher.dispatch({
                                type: "MESSAGE_START_EDIT",
                                channelId: currentMessage.channel_id,
                                messageId: currentMessage.id,
                                content: currentMessage.content,
                            });
                        }
                    };

                    const iconId = getAssetIDByName("ic_edit_24px") ?? getAssetIDByName("edit");

                    const iconElement = ActionSheetRow?.Icon ? React.createElement(ActionSheetRow.Icon, { source: iconId }) : null;
                    const editButton = React.createElement(ActionSheetRow, {
                        label: "Edit Locally",
                        icon: iconElement,
                        onPress: handleEdit
                    });

                    buttons.splice(position, 0, editButton);
                });
            });
        }));

        if (Messages) {
            patches.push(before("editMessage", Messages, (args) => {
                const [channelId, messageId, message] = args;

                if (isEditing) {
                    const baseMessage = edits.get(messageId);
                    if (!baseMessage) return;

                    FluxDispatcher.dispatch({
                        type: "MESSAGE_UPDATE",
                        message: {
                            ...baseMessage,
                            content: message.content,
                            edited_timestamp: null,
                        },
                        otherPluginBypass: true,
                    });
                    return false;
                }
            }));

            if (Messages.endEditMessage) {
                patches.push(after("endEditMessage", Messages, () => {
                    if (isEditing) {
                        isEditing = false;
                    }
                }));
            }
        }
    },

    onUnload() {
        patches.forEach((p) => p());
        patches = [];
        edits.clear();
    }
};
                    if (buttons.some((b) => b?.props?.label === "Edit Locally")) return;

                    let position = buttons.findIndex((x) => {
                        const lbl = x?.props?.label?.toLowerCase() || "";
                        const msgProp = typeof x?.props?.message === "string" ? x.props.message.toLowerCase() : "";
                        return lbl.includes("mark unread") || msgProp.includes("mark_unread");
                    });

                    if (position === -1) position = 0;

                    const handleEdit = () => {
                        isEditing = true;
                        if (!edits.has(currentMessage.id)) {
                            edits.set(currentMessage.id, JSON.parse(JSON.stringify(currentMessage)));
                        }
                        LazyActionSheet.hideActionSheet();

                        if (Messages?.startEditMessage) {
                            Messages.startEditMessage(currentMessage.channel_id, currentMessage.id, currentMessage.content);
                        } else {
                            FluxDispatcher.dispatch({
                                type: "MESSAGE_START_EDIT",
                                channelId: currentMessage.channel_id,
                                messageId: currentMessage.id,
                                content: currentMessage.content,
                            });
                        }
                    };

                    const iconId = getAssetIDByName("ic_edit_24px") ?? getAssetIDByName("edit");

                    const iconElement = ActionSheetRow.Icon ? React.createElement(ActionSheetRow.Icon, { source: iconId }) : null;
                    const editButton = React.createElement(ActionSheetRow, {
                        label: "Edit Locally",
                        icon: iconElement,
                        onPress: handleEdit
                    });

                    buttons.splice(position, 0, editButton);
                });
            });
        }));

        if (Messages) {
            patches.push(before("editMessage", Messages, (args) => {
                const [channelId, messageId, message] = args;

                if (isEditing) {
                    const baseMessage = edits.get(messageId);
                    if (!baseMessage) return;

                    FluxDispatcher.dispatch({
                        type: "MESSAGE_UPDATE",
                        message: {
                            ...baseMessage,
                            content: message.content,
                            edited_timestamp: null,
                        },
                        otherPluginBypass: true,
                    });
                    return false;
                }
            }));

            if (Messages.endEditMessage) {
                patches.push(after("endEditMessage", Messages, () => {
                    if (isEditing) {
                        isEditing = false;
                    }
                }));
            }
        }
    },

    onUnload() {
        patches.forEach((p) => p());
        patches = [];
        edits.clear();
    }
};
