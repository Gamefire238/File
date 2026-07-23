// ==UserScript==
// @name         Auto Translate — Berry Edition Pro
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Auto Translate with Settings Panel + Speed Optimized
// @author       Fixed for Berry
// @match        *://*/*
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ============ DEFAULT SETTINGS ============
    const DEFAULTS = {
        targetLang: 'id',
        autoTranslate: true,
        translateOnSelect: true,
        showSettings: true,
        cacheEnabled: true,
        batchSize: 20,
        delayMs: 100
    };

    // ============ LOAD/SETTINGS ============
    function loadSettings() {
        try {
            const saved = localStorage.getItem('berry_translate_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...DEFAULTS, ...parsed };
            }
        } catch (e) {}
        return { ...DEFAULTS };
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem('berry_translate_settings', JSON.stringify(settings));
        } catch (e) {}
    }

    let SETTINGS = loadSettings();

    // ============ PENYIMPANAN CACHE ============
    function setData(key, value) {
        if (!SETTINGS.cacheEnabled) return;
        try {
            localStorage.setItem('berry_translate_' + key, JSON.stringify(value));
        } catch (e) {}
    }

    function getData(key) {
        if (!SETTINGS.cacheEnabled) return null;
        try {
            return JSON.parse(localStorage.getItem('berry_translate_' + key));
        } catch (e) {
            return null;
        }
    }

    // ============ FUNGSI TERJEMAH (OPTIMASI) ============
    const translateQueue = [];
    let isProcessing = false;
    let lastRequestTime = 0;

    async function translateText(text, targetLang) {
        if (!text || text.trim().length === 0) return text;
        
        const cacheKey = text + '_' + targetLang;
        const cached = getData(cacheKey);
        if (cached) return cached;

        return new Promise((resolve) => {
            translateQueue.push({ text, targetLang, cacheKey, resolve });
            processQueue();
        });
    }

    async function processQueue() {
        if (isProcessing || translateQueue.length === 0) return;
        isProcessing = true;

        const now = Date.now();
        const waitTime = Math.max(0, SETTINGS.delayMs - (now - lastRequestTime));
        if (waitTime > 0) {
            await new Promise(r => setTimeout(r, waitTime));
        }

        const batch = translateQueue.splice(0, SETTINGS.batchSize);
        
        try {
            const promises = batch.map(async (item) => {
                try {
                    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + item.targetLang + '&dt=t&q=' + encodeURIComponent(item.text);
                    const response = await fetch(url);
                    
                    if (!response.ok) throw new Error('Network error');
                    
                    const data = await response.json();
                    let result = '';
                    
                    if (data && data[0]) {
                        for (let i = 0; i < data[0].length; i++) {
                            if (data[0][i] && data[0][i][0]) {
                                result += data[0][i][0];
                            }
                        }
                    }
                    
                    if (result) {
                        setData(item.cacheKey, result);
                        item.resolve(result);
                    } else {
                        item.resolve(item.text);
                    }
                } catch (e) {
                    console.error('Translate error:', e);
                    item.resolve(item.text);
                }
            });

            await Promise.all(promises);
            lastRequestTime = Date.now();
        } catch (e) {
            console.error('Batch error:', e);
        }

        isProcessing = false;
        if (translateQueue.length > 0) {
            processQueue();
        }
    }

    // ============ TERJEMAHKAN HALAMAN (OPTIMASI) ============
    async function translatePage() {
        const elements = document.querySelectorAll('body *:not(script):not(style):not(input):not(textarea):not(select)');
        const textNodes = [];
        
        for (const el of elements) {
            if (el.dataset.translated === 'true') continue;
            
            const childNodes = el.childNodes;
            for (const node of childNodes) {
                if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                    textNodes.push({
                        node: node,
                        text: node.textContent.trim(),
                        el: el
                    });
                }
            }
        }

        for (let i = 0; i < textNodes.length; i++) {
            const item = textNodes[i];
            const translated = await translateText(item.text, SETTINGS.targetLang);
            
            if (translated && translated !== item.text) {
                item.node.textContent = translated;
                item.el.dataset.translated = 'true';
                item.el.dataset.original = item.text;
            }

            updateProgress(i + 1, textNodes.length);
        }
    }

    // ============ PANEL SETTINGS ============
    function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'berry-translate-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999999;
            background: #1a1a2e;
            color: #eee;
            padding: 25px;
            border-radius: 16px;
            min-width: 320px;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            font-family: -apple-system, sans-serif;
            display: none;
            border: 1px solid #333;
            max-height: 80vh;
            overflow-y: auto;
        `;

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2 style="margin:0;font-size:20px;color:#4285f4;">⚙️ Pengaturan</h2>
                <button id="close-panel" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;">✕</button>
            </div>

            <div style="margin-bottom:15px;">
                <label style="display:block;font-size:13px;color:#aaa;margin-bottom:5px;">🌐 Bahasa Target</label>
                <select id="target-lang" style="width:100%;padding:10px;border-radius:8px;background:#2a2a4a;color:#eee;border:1px solid #444;font-size:14px;">
                    <option value="id">🇮🇩 Indonesia</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="ja">🇯🇵 Japanese</option>
                    <option value="ko">🇰🇷 Korean</option>
                    <option value="zh-CN">🇨🇳 Chinese (Simplified)</option>
                    <option value="zh-TW">🇹🇼 Chinese (Traditional)</option>
                    <option value="es">🇪🇸 Spanish</option>
                    <option value="fr">🇫🇷 French</option>
                    <option value="de">🇩🇪 German</option>
                    <option value="ar">🇸🇦 Arabic</option>
                    <option value="ru">🇷🇺 Russian</option>
                    <option value="pt">🇵🇹 Portuguese</option>
                    <option value="it">🇮🇹 Italian</option>
                    <option value="nl">🇳🇱 Dutch</option>
                    <option value="hi">🇮🇳 Hindi</option>
                </select>
            </div>

            <div style="margin-bottom:12px;">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:8px;background:#2a2a4a;">
                    <input type="checkbox" id="auto-translate" ${SETTINGS.autoTranslate ? 'checked' : ''}>
                    <span>🔄 Auto Translate halaman</span>
                </label>
            </div>

            <div style="margin-bottom:12px;">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:8px;background:#2a2a4a;">
                    <input type="checkbox" id="translate-select" ${SETTINGS.translateOnSelect ? 'checked' : ''}>
                    <span>📋 Terjemahkan teks pilihan</span>
                </label>
            </div>

            <div style="margin-bottom:12px;">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:8px;background:#2a2a4a;">
                    <input type="checkbox" id="enable-cache" ${SETTINGS.cacheEnabled ? 'checked' : ''}>
                    <span>💾 Cache terjemahan</span>
                </label>
            </div>

            <div style="margin-bottom:15px;">
                <label style="display:block;font-size:13px;color:#aaa;margin-bottom:5px;">⚡ Kecepatan (delay ms)</label>
                <input type="range" id="delay-slider" min="50" max="500" value="${SETTINGS.delayMs}" style="width:100%;">
                <span id="delay-value" style="font-size:12px;color:#4285f4;">${SETTINGS.delayMs}ms</span>
            </div>

            <div style="display:flex;gap:10px;margin-top:15px;">
                <button id="save-settings" style="flex:1;padding:12px;border:none;border-radius:8px;background:#4285f4;color:white;font-weight:bold;cursor:pointer;">💾 Simpan</button>
                <button id="reset-settings" style="flex:1;padding:12px;border:none;border-radius:8px;background:#e74c3c;color:white;font-weight:bold;cursor:pointer;">🔄 Reset</button>
            </div>

            <div id="progress-bar" style="margin-top:15px;display:none;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#aaa;">
                    <span>Menerjemahkan...</span>
                    <span id="progress-text">0/0</span>
                </div>
                <div style="width:100%;height:6px;background:#2a2a4a;border-radius:3px;margin-top:5px;overflow:hidden;">
                    <div id="progress-fill" style="height:100%;width:0%;background:#4285f4;border-radius:3px;transition:width 0.3s;"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        return panel;
    }

    // ============ TOMBOL UTAMA (⚙️) ============
    function createMainButton() {
        const btn = document.createElement('div');
        btn.id = 'berry-main-btn';
        btn.innerHTML = '⚙️';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999998;
            background: #1a1a2e;
            color: white;
            width: 55px;
            height: 55px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            border: 2px solid #4285f4;
            user-select: none;
            transition: transform 0.2s, background 0.2s;
        `;
        btn.onmouseover = () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.background = '#4285f4';
        };
        btn.onmouseout = () => {
            btn.style.transform = 'scale(1)';
            btn.style.background = '#1a1a2e';
        };
        btn.onclick = async function() {
            const panel = document.getElementById('berry-translate-panel');
            
            // Jika panel terbuka, tutup
            if (panel.style.display === 'block') {
                panel.style.display = 'none';
                return;
            }

            // Cek apakah ada teks yang dipilih
            const selection = window.getSelection().toString().trim();
            if (selection) {
                // Jika ada teks dipilih → terjemahkan
                const translated = await translateText(selection, SETTINGS.targetLang);
                alert('📝 Terjemahan:\n\n' + translated);
            } else {
                // Jika tidak ada → buka panel pengaturan
                panel.style.display = 'block';
                loadSettingsToPanel();
            }
        };
        document.body.appendChild(btn);
        return btn;
    }

    // ============ PROGRESS BAR ============
    function showProgress(show) {
        const bar = document.getElementById('progress-bar');
        if (bar) {
            bar.style.display = show ? 'block' : 'none';
        }
    }

    function updateProgress(current, total) {
        const text = document.getElementById('progress-text');
        const fill = document.getElementById('progress-fill');
        if (text) text.textContent = `${current}/${total}`;
        if (fill) fill.style.width = `${(current/total)*100}%`;
    }

    // ============ PANEL FUNCTIONS ============
    function loadSettingsToPanel() {
        const settings = loadSettings();
        document.getElementById('target-lang').value = settings.targetLang;
        document.getElementById('auto-translate').checked = settings.autoTranslate;
        document.getElementById('translate-select').checked = settings.translateOnSelect;
        document.getElementById('enable-cache').checked = settings.cacheEnabled;
        document.getElementById('delay-slider').value = settings.delayMs;
        document.getElementById('delay-value').textContent = settings.delayMs + 'ms';
    }

    function saveSettingsFromPanel() {
        SETTINGS.targetLang = document.getElementById('target-lang').value;
        SETTINGS.autoTranslate = document.getElementById('auto-translate').checked;
        SETTINGS.translateOnSelect = document.getElementById('translate-select').checked;
        SETTINGS.cacheEnabled = document.getElementById('enable-cache').checked;
        SETTINGS.delayMs = parseInt(document.getElementById('delay-slider').value);
        
        saveSettings(SETTINGS);
        
        alert('✅ Pengaturan disimpan!');
        document.getElementById('berry-translate-panel').style.display = 'none';
    }

    // ============ EVENT LISTENERS ============
    function setupEventListeners() {
        // Close panel
        document.addEventListener('click', function(e) {
            if (e.target.id === 'close-panel') {
                document.getElementById('berry-translate-panel').style.display = 'none';
            }
        });

        // Save settings
        document.addEventListener('click', function(e) {
            if (e.target.id === 'save-settings') {
                saveSettingsFromPanel();
            }
        });

        // Reset settings
        document.addEventListener('click', function(e) {
            if (e.target.id === 'reset-settings') {
                localStorage.removeItem('berry_translate_settings');
                SETTINGS = { ...DEFAULTS };
                saveSettings(SETTINGS);
                loadSettingsToPanel();
                alert('🔄 Settings direset ke default!');
            }
        });

        // Delay slider
        document.addEventListener('input', function(e) {
            if (e.target.id === 'delay-slider') {
                document.getElementById('delay-value').textContent = e.target.value + 'ms';
            }
        });

        // Context menu (teks pilihan)
        document.addEventListener('contextmenu', async function(e) {
            if (!SETTINGS.translateOnSelect) return;
            
            const selection = window.getSelection().toString().trim();
            if (selection) {
                e.preventDefault();
                const translated = await translateText(selection, SETTINGS.targetLang);
                alert('📝 Terjemahan:\n\n' + translated);
            }
        });
    }

    // ============ INISIALISASI ============
    function init() {
        createSettingsPanel();
        createMainButton();
        setupEventListeners();

        if (SETTINGS.autoTranslate) {
            if (document.readyState === 'complete') {
                showProgress(true);
                translatePage().then(() => showProgress(false));
            } else {
                window.addEventListener('load', function() {
                    showProgress(true);
                    translatePage().then(() => showProgress(false));
                });
            }
        }

        console.log('✅ Auto Translate Berry Pro aktif!');
        console.log('📌 Klik ⚙️ → buka pengaturan');
        console.log('📌 Pilih teks + klik ⚙️ → terjemahkan');
        console.log('📌 Klik kanan teks → terjemahkan');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();