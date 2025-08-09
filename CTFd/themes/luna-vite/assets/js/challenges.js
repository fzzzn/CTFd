import Alpine from "alpinejs";
import CTFd from "./base";
import dayjs from "dayjs";
import updateLocale from "dayjs/plugin/updateLocale";
import { Notyf } from "notyf";
import { scrollUpdate, itemHeight } from "./utils/scrollLoop";
import { copyTextToClipboard } from "./utils/clipboard";
import { initModal } from "./modal";
import persist from "@alpinejs/persist";
import dialogPolyfill from 'dialog-polyfill';
import Konami from 'konami';
import { Howl } from "howler";
import { _ } from './utils/i18n.js';

const knm = new Konami(function () {
    /*! SEKAI{→↓↑→→↓→→↑↑↓↓←→←→} */
    window.dispatchEvent(new Event("lrlr"));
});
knm.pattern = "39403839394039393838404037393739";
knm.iphone.keys = ["RIGHT", "DOWN", "UP", "RIGHT", "RIGHT", "DOWN", "RIGHT", "RIGHT", "UP", "UP", "DOWN", "DOWN", "LEFT", "RIGHT", "LEFT", "RIGHT"];

Alpine.plugin(persist);

dayjs.extend(updateLocale);
dayjs.updateLocale('en', {
    relativeTime: {
        future: "+%s",
        past: "-%s",
        s: _('%d<small>s</small>'),
        m: _("1<small>min</small>"),
        mm: _("%d<small>mins</small>"),
        h: _("1<small>hr</small>"),
        hh: _("%d<small>hrs</small>"),
        d: _("1<small>d</small>"),
        dd: _("%d<small>d</small>"),
        M: _("1<small>mth</small>"),
        MM: _("%d<small>mths</small>"),
        y: _("1<small>yr</small>"),
        yy: _("%d<small>yrs</small>"),
    }
});


window.init = window.init || {};
window.init.themeSettings = window.init.themeSettings || {};

const difficultyMapping = {
    [window.init.themeSettings.tag_difficulty_1]: 1,
    [window.init.themeSettings.tag_difficulty_2]: 2,
    [window.init.themeSettings.tag_difficulty_3]: 3,
    [window.init.themeSettings.tag_difficulty_4]: 4,
    [window.init.themeSettings.tag_difficulty_5]: 5,
};

const colorMapping = {
    [window.init.themeSettings.cat_name_misc]: "#dbdbdb",
    [window.init.themeSettings.cat_name_crypto]: "#cbfdc6",
    [window.init.themeSettings.cat_name_forensics]: "#c6d8fd",
    [window.init.themeSettings.cat_name_rev]: "#e9c6fd",
    [window.init.themeSettings.cat_name_pwn]: "#fde2c6",
    [window.init.themeSettings.cat_name_ppc]: "#f8fdc6",
    [window.init.themeSettings.cat_name_web]: "#c6cbfd",
    [window.init.themeSettings.cat_name_blockchains]: "#c6cbfd",
};

const sortFunctions = {
    Difficulty(a, b) {
        return ((a.difficulty || 1) - (b.difficulty || 1)) || a.name.localeCompare(b.name);
    },
    Score(a, b) {
        return ((a.value || 0) - (b.value || 0)) || a.name.localeCompare(b.name);
    },
    Solves(a, b) {
        return ((a.solves || 0) - (b.solves || 0)) || a.name.localeCompare(b.name);
    },
    Name(a, b) {
        return a.name.localeCompare(b.name);
    },
};

const escapeHtml = (unsafe) => {
    return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function addTargetBlank(html) {
    let dom = new DOMParser();
    let view = dom.parseFromString(html, "text/html");
    let links = view.querySelectorAll('a[href*="://"]');
    links.forEach((link) => {
        link.setAttribute("target", "_blank");
    });
    return view.documentElement.outerHTML;
}

window.Alpine = Alpine;

const notyf = new Notyf({
    duration: 0,
    dismissible: true,
    ripple: true,
    position: {
        x: 'left',
        y: 'top',
    },
    types: [
        {
            type: "info",
            backgroundColor: "#5CC9BB",
        },
        {
            type: 'success',
            className: 'notyf__toast--success',
            backgroundColor: '#3dc763',
            icon: {
                className: 'notyf__icon--success',
                tagName: 'i',
            },
        },
        {
            type: 'error',
            className: 'notyf__toast--error',
            backgroundColor: '#ed3d3d',
            icon: {
                className: 'notyf__icon--error',
                tagName: 'i',
            },
        },
    ]
});


Alpine.store("challenge", {
    data: {
        view: "",
    },
    loading: false,
});

Alpine.data("Challenge", () => ({
    id: null,
    next_id: null,
    submission: "",
    tab: null,
    solves: null,
    submitting: false,
    hints: {},
    // response: null,

    init() {
        initModal(this.$refs.solversModal, [], [this.$refs.solversModalClose]);
        document.querySelectorAll(".hintModal").forEach((modal) => {
            console.log(modal);
            this.hints[parseInt(modal.dataset.hintId)] = { id: null, html: null };
            const hintClose = modal.querySelector("button");
            initModal(modal, [], [hintClose]);
        });
    },

    async showSolves() {
        this.solves = await CTFd.pages.challenge.loadSolves(this.id);
        this.solves.forEach((solve, idx) => {
            solve.timeDiff = "";
            if (idx === 0 && window.init.start) {
                solve.timeDiff = dayjs.duration(dayjs(solve.date).diff(dayjs.unix(window.init.start))).humanize(true);
            } else if (idx > 0) {
                solve.timeDiff = dayjs.duration(dayjs(solve.date).diff(dayjs(this.solves[idx - 1].date))).humanize(true);
            }
            solve.date = dayjs(solve.date).format("D MMM YYYY, HH:mm:ss");
            return solve;
        });
        // new Tab(this.$el).show();
        dialogPolyfill.registerDialog(this.$refs.solversModal);
        this.$refs.solversModal.showModal();
    },

    getNextId() {
        let data = Alpine.store("challenge").data;
        return data.next_id;
    },

    async nextChallenge() {
        Modal.getOrCreateInstance("[x-ref='challengeWindow']").hide();

        // Dispatch load-challenge event to call loadChallenge in the ChallengeBoard
        this.$dispatch("load-challenge", this.getNextId());
    },

    async submitChallenge() {
        this.submitting = true;
        const response = await CTFd.pages.challenge.submitChallenge(
            this.id,
            this.submission);
        this.submitting = false;
        notyf.open({
            type: (response.data.status === "correct" ? "success" :
                response.data.status === "incorrect" ? "error" : "info"),
            message: `<code>${escapeHtml(this.submission)}</code><br>${response.data.message}`,
        });
        if (response.data.status === "correct") {
            this.submission = "";
        }
        this.$dispatch("load-challenges");
    },

    copyText(text) {
        copyTextToClipboard(text, this.$refs.connectionBox);
    },

    collapse() {
        this.$dispatch("collapse-challenge");
    },

    async showHint(hintId, loadFromServer) {
        console.log("showHint", hintId, loadFromServer);
        const modalNode = this.$refs[`hintDialog${hintId}`];
        dialogPolyfill.registerDialog(modalNode);
        if (loadFromServer) {
            let response = await CTFd.pages.challenge.loadHint(hintId);
            let hint = response.data;
            let html = `<div class="warning">${_("Hint is not available.")}</div>`;
            if (hint.content) {
                html = addTargetBlank(hint.html);
            } else {
                let answer = await CTFd.pages.challenge.displayUnlock(hintId);
                if (answer) {
                    let unlock = await CTFd.pages.challenge.loadUnlock(hintId);

                    if (unlock.success) {
                        let response = await CTFd.pages.challenge.loadHint(hintId);
                        let hint = response.data;
                        html = addTargetBlank(hint.html);
                    } else {
                        CTFd._functions.challenge.displayUnlockError(unlock);
                        return;
                    }
                }
            }
            this.hints[hintId] = { id: hintId, html: html };
        }
        modalNode.showModal();
    },
}));

Alpine.data("ChallengeBoard", function () {
    return {
        loaded: false,
        challenges: [],
        filteredChallenges: [],
        lrn: null,
        selectedId: null,
        category: null,
        oobe: this.$persist(true),
        sortOrder: this.$persist("Difficulty"),
        filterCondition: this.$persist("All"),
        loopHighlight: this.$persist(false),
        highContrast: this.$persist(false),

        // Infinite scroll attributes
        repeatTimes: 1,

        async init() {
            initModal(this.$refs.settingsModal, [], [this.$refs.settingsModalClose]);
            const initHash = window.location.hash;
            window.lastClick = 0;
            await this.loadChallenges();
            this.loaded = true;
            await Alpine.nextTick();
            await this.setCategory(null);
            this.$refs.listNode.addEventListener("scroll", () => {
                window.requestAnimationFrame(scrollUpdate);
            }, false);

            if (initHash.length > 0) {
                await this.loadChalByName(decodeURIComponent(initHash.substring(1)));
            }

            if (this.oobe) {
                dialogPolyfill.registerDialog(this.$refs.oobeModal);
                this.$refs.oobeModal.showModal();
            }
        },

        async loadChalByName(name) {
            let idx = name.lastIndexOf("-");
            let pieces = [name.slice(0, idx), name.slice(idx + 1)];
            let id = parseInt(pieces[1]);
            let listIdx = this.challenges.findIndex((chal) => chal.id === id);
            await this.selectChallenge(listIdx, null);
        },

        getCategories() {
            const categories = [];

            this.challenges.forEach((challenge) => {
                const { category } = challenge;

                if (!categories.includes(category)) {
                    categories.push(category);
                }
            });

            const knownCats = [
                window.init.themeSettings.cat_name_misc,
                window.init.themeSettings.cat_name_crypto,
                window.init.themeSettings.cat_name_forensics,
                window.init.themeSettings.cat_name_rev,
                window.init.themeSettings.cat_name_pwn,
                window.init.themeSettings.cat_name_ppc,
                window.init.themeSettings.cat_name_web,
            ];

            const sortedCategories = [
                ...knownCats.filter((cat) => categories.includes(cat)),
                ...categories
                    .sort((a, b) => a.localeCompare(b))
                    .filter((cat) => !knownCats.includes(cat)),
            ];

            return sortedCategories;
        },

        getCategoryWithIcons() {
            const mapping = {};
            
            // Debug logging
            console.log('Theme settings:', window.init.themeSettings);
            console.log('Tag images:', window.tagImages);
            
            // Map theme setting names to image URLs (if theme settings exist)
            if (window.init.themeSettings) {
                mapping[window.init.themeSettings.cat_name_misc] = window.tagImages.misc;
                mapping[window.init.themeSettings.cat_name_crypto] = window.tagImages.crypto;
                mapping[window.init.themeSettings.cat_name_forensics] = window.tagImages.forensics;
                mapping[window.init.themeSettings.cat_name_rev] = window.tagImages.reverse;
                mapping[window.init.themeSettings.cat_name_pwn] = window.tagImages.pwn;
                mapping[window.init.themeSettings.cat_name_ppc] = window.tagImages.ppc;
                mapping[window.init.themeSettings.cat_name_web] = window.tagImages.web;
                mapping[window.init.themeSettings.cat_name_blockchains] = window.tagImages.blockchains;
            }
            
            // Fallback mapping for common category names (case insensitive)
            const fallbackMapping = {
                'misc': window.tagImages.misc,
                'miscellaneous': window.tagImages.misc,
                'crypto': window.tagImages.crypto,
                'cryptography': window.tagImages.crypto,
                'forensics': window.tagImages.forensics,
                'reverse': window.tagImages.reverse,
                'reversing': window.tagImages.reverse,
                'rev': window.tagImages.reverse,
                'pwn': window.tagImages.pwn,
                'pwning': window.tagImages.pwn,
                'binary': window.tagImages.pwn,
                'ppc': window.tagImages.ppc,
                'programming': window.tagImages.ppc,
                'web': window.tagImages.web,
                'web exploitation': window.tagImages.web,
                'blockchain': window.tagImages.blockchains,
                'blockchains': window.tagImages.blockchains
            };

            const categories = this.getCategories();
            console.log('Available categories:', categories);
            
            const result = categories.map(categoryName => {
                let imageUrl = mapping[categoryName];
                
                // If no direct mapping found, try fallback mapping
                if (!imageUrl) {
                    imageUrl = fallbackMapping[categoryName.toLowerCase()];
                }
                
                console.log(`Category "${categoryName}" mapped to image:`, imageUrl);
                return [categoryName, imageUrl || null];
            });
            
            console.log('Final category mapping:', result);
            return result;
        },

        getChallenges(category) {
            let challenges = this.challenges;

            if (category) {
                challenges = this.challenges.filter(
                    (challenge) => challenge.category === category
                );
            }

            if (this.filterCondition === "Unsolved") {
                challenges = challenges.filter(c => !c.solved_by_me);
            } else if (this.filterCondition === "Solved") {
                challenges = challenges.filter(c => c.solved_by_me);
            }

            try {
                // const f = CTFd.config.themeSettings.challenge_order;
                // if (f) {
                //     const getSort = new Function(`return (${f})`);
                //     challenges.sort(getSort());
                // }
                // console.log("Sort order", this.sortOrder);
                challenges.sort(sortFunctions[this.sortOrder]);
                // console.log("Sorted result", challenges.map(a => a.name));
            } catch (error) {
                // Ignore errors with theme challenge sorting
                console.log("Error running challenge_order function");
                console.log(error);
            }

            return challenges;
        },

        async loadChallenges() {
            this.challenges = (await CTFd.pages.challenges.getChallenges()).map(this.addChallengeProperties);
        },

        async loadChallenge(challengeId) {
            if (challengeId === null) {
                Alpine.store("challenge").data.view = "";
                this.setColor(null);
            } else {
                Alpine.store("challenge").data.view = "";
                Alpine.store("challenge").loading = true;
                await CTFd.pages.challenge.displayChallenge(challengeId, (challenge) => {
                    challenge.data.view = addTargetBlank(challenge.data.view);
                    Alpine.store("challenge").loading = false;
                    Alpine.store("challenge").data = challenge.data;

                    this.setColor(challenge.data.category);

                    // nextTick is required here because we're working in a callback
                    Alpine.nextTick(() => {
                        this.$refs.challengesContentWrapper.focus();
                    });
                });
            }
        },

        addChallengeProperties(challenge) {
            const tags = challenge.tags.map((tag) => tag.value);
            const labels = [];
            challenge.difficulty = 1;
            tags.forEach((tag) => {
                if (difficultyMapping[tag]) challenge.difficulty = difficultyMapping[tag];
                else labels.push(tag);
            });
            challenge.label = labels.join(", ");
            // console.log(tags, labels, challenge.difficulty, difficultyMapping);
            return challenge;
        },

        // Rendering functions

        async setCategory(categoryName) {
            if (this.category === categoryName && this.filteredChallenges.length > 0) return;
            this.category = categoryName;
            history.replaceState(undefined, undefined, "#");
            this.loadChallenge(null);
            this.filteredChallenges = this.getChallenges(categoryName);
            this.repeatTimes = this.filteredChallenges.length === 0 ? 0 : Math.ceil(
                window.screen.height / (this.filteredChallenges.length * itemHeight)
            );
            this.selectedId = null;
            await Alpine.nextTick();
            this.centerNode(0);
        },

        async selectChallenge(idx, tgt) {
            const challenge = this.filteredChallenges[idx];
            if (tgt) tgt = tgt.closest(".challengeItem");
            if (this.selectedId == challenge.id) {
                this.centerNode(idx, tgt);
                return;
            }

            this.selectedId = challenge.id;
            history.replaceState(undefined, undefined, `#${challenge.name.replace(/ /g, "-")}-${challenge.id}`);
            // Pseudo centering transition.
            this.centerNode(idx, tgt);
            await this.loadChallenge(challenge.id);
        },

        async loadChallengeEvt(challengeId) {
            const index = this.challenges.findIndex((v) => v.id === challengeId);
            await this.setCategory(null);
            await this.selectChallenge(index);
        },

        async loadChallengesEvt() {
            const selectedChallengeId = this.selectedId || null;
            await this.loadChallenges();
            this.filteredChallenges = this.getChallenges(this.category);
            this.repeatTimes = this.filteredChallenges.length === 0 ? 0 : Math.ceil(
                window.screen.height / (this.filteredChallenges.length * itemHeight)
            );
            if (selectedChallengeId !== null) {
                await this.loadChallenge(selectedChallengeId);
            }
        },

        collapseChallengeEvt() {
            this.selectedId = null;
            history.replaceState(undefined, undefined, "#");
            setTimeout(() => this.loadChallenge(null), 500);
        },

        async refreshSortFilter() {
            this.filteredChallenges = this.getChallenges(this.category);
            var centerIdx = null;
            if (this.selectedId !== null) {
                centerIdx = this.filteredChallenges.findIndex((v) => v.id === this.selectedId);
                if (centerIdx < 0) centerIdx = null;
            }
            this.repeatTimes = this.filteredChallenges.length === 0 ? 0 : Math.ceil(
                window.screen.height / (this.filteredChallenges.length * itemHeight)
            );
            await Alpine.nextTick();
            if (centerIdx !== null) this.centerNode(centerIdx);
        },

        // Utility functions

        repeatArray(arr, repeats) {
            return Array.from({ length: repeats }, () => arr).flat();
        },

        // Center a node by index, if target is specified, do a pseudo centering transition
        centerNode(id, tgt) {
            const list = this.$refs.listNode;
            const center = list.querySelector(`[data-is-center="${id}"]`);
            if (center === null) return;

            if (tgt) {
                const isCenter = tgt.isEqualNode(center);
                if (!isCenter) {
                    var diff = tgt.offsetTop - list.scrollTop;
                    list.scrollTop = center.offsetTop - diff;
                }
                // console.log("centerNode", isCenter, id, tgt, isCenter, list.scrollTop);
                // console.log("centerNode...->", center.offsetTop - (list.clientHeight - center.clientHeight) / 2);
                list.scrollTo({
                    top: center.offsetTop - (list.clientHeight - center.clientHeight) / 2,
                    behavior: "smooth"
                });
            } else {
                list.scrollTop =
                    center.offsetTop - (list.clientHeight - center.clientHeight) / 2;
            }
        },

        setColor(category) {
            var val = "";
            if (colorMapping[category]) {
                val = `linear-gradient(to bottom, #dddddd, ${colorMapping[category]})`;
            }
            document.documentElement.style.setProperty("--background-gradient", val);
        },

        oobeUpdate(value) {
            this.oobe = false;
            this.loopHighlight = value;
            const modalNode = this.$refs.oobeModal;

            const modalHideAnimationEndCallback = () => {
                modalNode.classList.remove('hide');
                modalNode.close();
                modalNode.removeEventListener('webkitAnimationEnd', modalHideAnimationEndCallback, false);
            }

            modalNode.classList.add('hide');
            modalNode.addEventListener('webkitAnimationEnd', modalHideAnimationEndCallback, false);
        },

        async lrlr() {
            this.loaded = false;
            try {
                this.lrn = await (await fetch("https://sekai-world.github.io/sekai-master-db-diff/musics.json")).json();

                // Play a random music from the fetched data
                if (this.lrn && this.lrn.length > 0) {
                    const randomMusic = this.lrn[Math.floor(Math.random() * this.lrn.length)];
                    console.log('Selected music:', randomMusic);
                    console.log('Music ID:', randomMusic.id);
                    console.log('Music title:', randomMusic.title);

                    // Create Howl instance for music playback with multiple fallback sources
                    // Try different possible URL patterns for the music
                    const musicId = randomMusic.id.toString().padStart(4, '0'); // Pad with zeros if needed
                    const musicSources = [
                        `https://sekai-world.github.io/sekai-master-db-diff/music/long/${musicId}.mp3`,
                        `https://sekai-world.github.io/sekai-master-db-diff/music/short/${musicId}.mp3`,
                        `https://sekai-world.github.io/sekai-master-db-diff/music/long/${randomMusic.id}.mp3`,
                        `https://sekai-world.github.io/sekai-master-db-diff/music/short/${randomMusic.id}.mp3`,
                        // Alternative CDN or mirror
                        `https://assets.pjsek.ai/file/pjsekai-assets/music/long/${musicId}_01.mp3`,
                        // Fallback to a default notification sound if music fails
                        window.init.urlRoot + "/themes/luna-vite/static/sounds/notification.mp3"
                    ];

                    console.log('Trying music sources:', musicSources);

                    const musicHowl = new Howl({
                        src: musicSources,
                        autoplay: false,
                        loop: false,
                        volume: 0.3,
                        onload: () => {
                            console.log(`Playing: ${randomMusic.title}`);
                            // Show notification about the music
                            notyf.open({
                                type: "info",
                                message: `🎵 Now Playing: ${randomMusic.title}`,
                            });
                        },
                        onloaderror: (id, error) => {
                            console.log('Music load error:', error);
                            console.log('Attempted to load:', musicSources[0]);
                            // Show error with music title
                            notyf.open({
                                type: "error",
                                message: `Failed to load music: ${randomMusic.title || 'Unknown'}`,
                            });
                        },
                        onplayerror: (id, error) => {
                            console.log('Music play error:', error);
                            // Unlock audio context and retry
                            musicHowl.once('unlock', () => {
                                musicHowl.play();
                            });
                        }
                    });

                    // Function to unlock audio and play music
                    const playMusic = () => {
                        try {
                            musicHowl.play();
                        } catch (error) {
                            console.log('Error playing music:', error);
                            // Add click listener to unlock audio context
                            const unlockAudio = () => {
                                musicHowl.play();
                                document.removeEventListener('click', unlockAudio);
                                document.removeEventListener('touchstart', unlockAudio);
                            };

                            document.addEventListener('click', unlockAudio, { once: true });
                            document.addEventListener('touchstart', unlockAudio, { once: true });

                            notyf.open({
                                type: "info",
                                message: "Click anywhere to start music playback",
                            });
                        }
                    };

                    // Play the music
                    playMusic();
                } else {
                    // Fallback: play local notification sound if no music data
                    console.log('No music data available, playing fallback sound');
                    const fallbackHowl = new Howl({
                        src: [
                            window.init.urlRoot + "/themes/luna-vite/static/sounds/notification.webm",
                            window.init.urlRoot + "/themes/luna-vite/static/sounds/notification.mp3"
                        ],
                        volume: 0.5
                    });

                    fallbackHowl.play();
                    notyf.open({
                        type: "info",
                        message: "🎵 Konami code activated! (Fallback sound)",
                    });
                }
            } catch (e) {
                console.log('Error in lrlr function:', e);
                // Fallback: play local notification sound on error
                try {
                    const errorFallbackHowl = new Howl({
                        src: [
                            window.init.urlRoot + "/themes/luna-vite/static/sounds/notification.webm",
                            window.init.urlRoot + "/themes/luna-vite/static/sounds/notification.mp3"
                        ],
                        volume: 0.5
                    });

                    errorFallbackHowl.play();
                    notyf.open({
                        type: "info",
                        message: "🎵 Konami code activated! (Error fallback)",
                    });
                } catch (fallbackError) {
                    console.log('Fallback sound also failed:', fallbackError);
                    notyf.open({
                        type: "error",
                        message: "Failed to fetch music data and play fallback sound",
                    });
                }
            }
            this.loaded = true;
        },
    };
});

Alpine.start();
