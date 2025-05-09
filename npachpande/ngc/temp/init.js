/*
 * Copyright 2025 salesforce.com, inc.
 * All Rights Reserved
 * Company Confidential
 */

(() => {
    /**
     * Parent page elements class constants.
     */
    const TOP_CONTAINER_NAME = "agentforce-messaging";
    const LWR_IFRAME_NAME = "agentforce-messaging-frame";
    const INIT_SCRIPT_NAME = "init-agentforce-messaging";

    // =========================
    //  DOM Selectors
    // =========================
    function getTopContainer() {
        return document.getElementById(TOP_CONTAINER_NAME);
    }

    function getIframe() {
        return document.getElementById(LWR_IFRAME_NAME);
    }

    function getInitScriptElement() {
        return document.getElementById(INIT_SCRIPT_NAME);
    }

    function getSiteUrl() {
        try {
            return agentforce_messaging.settings.siteUrl;
        } catch (err) {
            console.error(`Error retrieving site URL: ${err}`);
        }
    }

    function handleResize(postMessage) {
        const frame = getIframe();

        if (frame) {
            // Update width and height if options are provided
            if (postMessage.width || postMessage.height) {
                if (postMessage.width) {
                    frame.style.width = postMessage.width;
                }
                if (postMessage.height) {
                    frame.style.height = postMessage.height;
                }
            }

            if (postMessage.state === "expanded") {
                frame.classList.remove("init");
                frame.classList.remove("normal");
                frame.classList.remove("closed");
                frame.classList.add("expanded");
            } else if (postMessage.state === "normal") {
                frame.classList.remove("init");
                frame.classList.remove("closed");
                frame.classList.remove("expanded");
                frame.classList.add("normal");
            } else if (postMessage.state === "closed") {
                frame.classList.remove("init");
                frame.classList.remove("expanded");
                frame.classList.remove("normal");
                frame.classList.add("closed");
            } else if (postMessage.state === "init") {
                frame.classList.add("init");
            }
        }
    }

    // =========================
    //  Iframe Message Handlers
    // =========================
    function handleMessageEvent(event) {
        const postMessage = event.data;
        switch (postMessage.type) {
            case "resize":
                handleResize(postMessage);
                break;
            case "text_message_link_click":
                handleLinkClick(postMessage);
                break;
            default:
                console.warn(
                    "Unrecognized postMessage event name: " + postMessage.type
                );
                break;
        }
    }

    /**
     * Handle a link click. If 'shouldOpenLinksInSameTab' setting is TRUE, open the link in the same tab and open a new tab if FALSE.
     * In case of Mobile Publisher, let the link navigation happen as usual per the app's control behavior.
     * @param {object} event - message event containing the link details
     */
    function handleLinkClick(event) {
        try {
            if (
                event &&
                event.data &&
                event.data.data &&
                event.data.data.link
            ) {
                const linkElement = document.createElement("a");
                linkElement.setAttribute("href", event.data.data.link);
                linkElement.setAttribute("rel", "noopener noreferrer");
                if (
                    isMobilePublisherApp() ||
                    !Boolean(
                        agentforce_messaging.settings.shouldOpenLinksInSameTab
                    )
                ) {
                    linkElement.setAttribute("target", "_blank");
                }
                linkElement.click();
            }
        } catch (err) {
            throw new Error(
                "handleLinkClick",
                `Something went wrong in handling a link click: ${err}`
            );
        }
    }

    /**
     * Sends configuration data to LWR app. Optional - Adds jwt & conversation data to configuration before sending if specified.
     * @param jwtData - Optional jwtData (accessToken & lastEventId).
     * @param conversationData - Optional new or existing conversation data.
     * @param errorData - Optional error data to pass to Chat Unavailable State.
     * @param isPageLoad - Whether we are attempting to continue an existing session (using an existing JWT from web storage) on page/script load.
     */
    function sendConfigurationToAppIframe() {
        let configData = Object.assign(
            {},
            agentforce_messaging.settings,
            agentforce_messaging.settings.snippetConfig
        );

        // TODO - Avoid adding targetElement to config data
        delete configData.targetElement;
        sendPostMessageToAppIframe("ESW_SET_CONFIG_EVENT", configData);
    }

    /**
     * Send a post message to the LWR App iframe window. If the frame is not ready, wait for it.
     *
     * @param {String} method - Name of method.
     * @param {Object} data - Data to send with message. Only included in post message if data is defined.
     */
    function sendPostMessageToAppIframe(method, data) {
        // lwrIframeReadyPromise.then(() => {
        const iframe = getIframe();

        if (typeof method !== "string") {
            throw new Error(
                `Expected a string to use as message param in post message, instead received ${method}.`
            );
        }

        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(
                {
                    method,
                    ...(data && { data })
                },
                getSiteUrl()
            );
        } else {
            console.warning(
                `Embedded Messaging iframe not available for post message with method ${method}.`
            );
        }
        // });
    }
    
    // =========================
    //  Initialization
    // =========================
    function AgentforceMessaging() {
        this.settings = {
            devMode: false,
            targetElement: document.body
        };
    }

    /**
     * Load the init.css file for this static file.
     */
    function loadCSS() {
        return new Promise((resolve, reject) => {
            let link = document.createElement("link");
            let initSrc = "";
            const initScriptElement = getInitScriptElement();

            if(!initScriptElement) {
                reject("Failed to locate init.js on page.");
            }

            link.id = "css";
            link.class = "css";
            initSrc = initScriptElement.src;
            link.href = initSrc.substring(0, initSrc.indexOf("/init.js")) + "/init.css";
            link.type = "text/css";
            link.rel = "stylesheet";

            link.onerror = reject;
            link.onload = resolve;

            document.getElementsByTagName("head")[0].appendChild(link);
        });
    }

    function createTopContainer() {
        const topContainerElement = document.createElement("div");

        // TODO check if top container already there

        topContainerElement.id = TOP_CONTAINER_NAME;
        topContainerElement.className = TOP_CONTAINER_NAME;

        return topContainerElement;
    }

    AgentforceMessaging.prototype.createIframe = function createIframe() {
        return new Promise((resolve, reject) => {
            try {
                const markupFragment = document.createDocumentFragment();
                const topContainer = createTopContainer();
                const iframe = document.createElement("iframe");

                iframe.title = LWR_IFRAME_NAME;
                iframe.className = LWR_IFRAME_NAME;
                iframe.id = LWR_IFRAME_NAME;

                iframe.style.backgroundColor = "transparent";
                iframe.allowTransparency = "true";

                let siteURL = getSiteUrl();
                // Ensure a '/' is at the end of an LWR URI so a redirect doesn't occur.
                if (!siteURL.endsWith("/")) siteURL += "/";

                iframe.src =
                    siteURL +
                    "?lwc.mode=" +
                    (agentforce_messaging.settings.devMode ? "dev" : "prod");
                // Allow microphone access for voice conversations.
                iframe.allow = "microphone";
                iframe.sandbox =
                    "allow-scripts allow-same-origin allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox";

                iframe.onload = resolve;
                iframe.onerror = reject;

                topContainer.appendChild(iframe);
                markupFragment.appendChild(topContainer);

                // Render static conversation button.
                agentforce_messaging.settings.targetElement.appendChild(
                    markupFragment
                );
            } catch (e) {
                reject(e);
            }
        });
    };

    AgentforceMessaging.prototype.init = function init(
        agentId,
        domainUrl,
        siteUrl,
        snippetConfig = {}
    ) {
        try {
            agentforce_messaging.settings.agentId = agentId;
            agentforce_messaging.settings.domainUrl = domainUrl;
            agentforce_messaging.settings.siteUrl = siteUrl;
            agentforce_messaging.settings.snippetConfig = snippetConfig;

            // Load CSS file.
            loadCSS()
                .then(() => {
                    console.log(`Loaded CSS`);
                })
                .catch(() => {
                    console.error(`Error loading CSS`);
                });

            // Load LWR site on page load.
            agentforce_messaging
                .createIframe()
                .then(() => {
                    console.log(`Created Agentforce Messaging frame`);

                    window.addEventListener("message", handleMessageEvent);

                    sendConfigurationToAppIframe();
                })
                .catch((e) => {
                    console.error(
                        `Error creating Agentforce Messaging frame: ${e}`
                    );
                });
        } catch (initError) {
            console.error(initError);
        }
    };

    if (!window.agentforce_messaging) {
        window.agentforce_messaging = new AgentforceMessaging();
    } else {
        console.error(`Agentforce Messaging has already been initialized`);
    }
})();
