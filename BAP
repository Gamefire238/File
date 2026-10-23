// ==UserScript==
// @name         Smart Autoplay & Preview Blocker
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Intercepts autoplay and pre-buffering for HTML5 videos and previews until explicitly triggered by user interaction.
// @author       Rion
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let userHasInteracted = false;

    const markInteraction = () => {
        userHasInteracted = true;
    };

    ['touchstart', 'touchend', 'mousedown', 'pointerdown', 'click'].forEach(evt => {
        window.addEventListener(evt, markInteraction, { capture: true, passive: true });
    });

    const originalPlay = HTMLMediaElement.prototype.play;

    HTMLMediaElement.prototype.play = function() {
        const video = this;

        if (!userHasInteracted && !video.dataset.userActivated) {
            video.preload = "none";
            video.removeAttribute('autoplay');

            const activateAndPlay = () => {
                video.dataset.userActivated = "true";
                video.preload = "auto";

                if (video.querySelector('source') && !video.src) {
                    video.load();
                }

                originalPlay.apply(video).catch(() => {});
            };

            ['touchstart', 'mouseenter', 'click', 'mousedown'].forEach(evt => {
                video.addEventListener(evt, activateAndPlay, { once: true, capture: true });
            });

            return Promise.reject(new DOMException("Autoplay blocked until user interaction", "NotAllowedError"));
        }

        return originalPlay.apply(this, arguments);
    };

    const processVideo = (video) => {
        if (!userHasInteracted && !video.dataset.userActivated) {
            video.preload = "none";
            video.removeAttribute('autoplay');
        }
    };

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'VIDEO') processVideo(node);
                    const subVideos = node.querySelectorAll ? node.querySelectorAll('video') : [];
                    subVideos.forEach(processVideo);
                }
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();