import { NetworkService } from './services/NetworkService.js';
import { ParserService } from './services/ParserService.js';
import { I18nService } from './services/I18nService.js'; 
import { CoreLogic } from './core/CoreLogic.js';

export class AppController {
    constructor() {
        this.net = new NetworkService();
        this.parser = new ParserService();
        this.i18n = new I18nService(); 
        this.logic = new CoreLogic();
        
        this.rawData = [];
        this.cachedP2P = null;
        this.cachedShop = null;
        this.lastUpdateTime = null;
        
        this.currentCategory = 'All';
        this.sortField = 'ratio';
        this.sortDesc = true;

        this.updatePrice = this.updatePrice.bind(this);
        this.toggleBonus = this.toggleBonus.bind(this);
        this.setCategory = this.setCategory.bind(this);
        this.sortTable = this.sortTable.bind(this);
        this.filterData = this.filterData.bind(this);
        this.fetchData = this.fetchData.bind(this);        
        this.changeLanguage = this.changeLanguage.bind(this);
    }

    async fetchData() {
        this._setLoading(true);
        try {
            const [p2p, cropsTS, fruitsTS] = await Promise.all([
                this.net.fetchData("https://sfl.world/api/v1/prices"),
                this.net.fetchData("https://raw.githubusercontent.com/sunflower-land/sunflower-land/refs/heads/main/src/features/game/types/crops.ts"),
                this.net.fetchData("https://raw.githubusercontent.com/sunflower-land/sunflower-land/refs/heads/main/src/features/game/types/fruits.ts")
            ]);

            // console.log("[Debug] P2P Raw Data:", p2p);

            const cropsParsed = this.parser.parseTS(cropsTS.content);
            const fruitsParsed = this.parser.parseTS(fruitsTS.content);
            this.cachedShop = { ...cropsParsed, ...fruitsParsed };
            this.cachedP2P = p2p;

            let timestamp = null;
            if (p2p && p2p.updatedAt) {
                timestamp = p2p.updatedAt;
            } else if (p2p && p2p.data && p2p.data.updatedAt) {
                timestamp = p2p.data.updatedAt;
            }

            if (timestamp) {
                const ts = Number(timestamp);
                this.lastUpdateTime = new Date(ts);
            } else {
                this.lastUpdateTime = new Date();
            }

            this._loadBonusSettings();
            this.triggerCalculation();

            const msg = `${this.i18n.t('Update Success')}: ${this.rawData.length} ${this.i18n.t('items')}`;
            this._setStatus(msg);
            
            this._updateUILabels(); 

        } catch (e) {
            console.error(e);
            this._setStatus(this.i18n.t('Update Failed'), true);
        } finally {
            this._setLoading(false);
        }
    }

    _loadBonusSettings() {
        const b5 = localStorage.getItem('sfl_bonus5') === 'true';
        const b10 = localStorage.getItem('sfl_bonus10') === 'true';
        const el5 = document.getElementById('bonus5');
        const el10 = document.getElementById('bonus10');
        if(el5) el5.checked = b5;
        if(el10) el10.checked = b10;
    }

    changeLanguage(langCode) {
        this.i18n.setLanguage(langCode);
        this._updateUILabels();
        this.filterData();

        if (this.rawData.length > 0) {
            const msg = `${this.i18n.t('Update Success')}: ${this.rawData.length} ${this.i18n.t('items')}`;
            this._setStatus(msg);
        } else {
            this._setStatus(this.i18n.t('Ready'));
        }
    }

    _updateUILabels() {
        const t = (k) => this.i18n.t(k);
        
        const langSelect = document.getElementById('langSelect');
        if (langSelect) {
            langSelect.value = this.i18n.getLang();
        }

        if(document.getElementById('th-item')) document.getElementById('th-item').innerHTML = `${t('Item')} <i class="fa-solid fa-sort"></i>`;
        if(document.getElementById('th-p2p')) document.getElementById('th-p2p').innerHTML = `${t('P2P Price')} <i class="fa-solid fa-sort"></i>`;
        if(document.getElementById('th-shop')) document.getElementById('th-shop').innerHTML = `${t('Betty Price')} <i class="fa-solid fa-sort"></i>`;
        if(document.getElementById('th-ratio')) document.getElementById('th-ratio').innerHTML = `${t('Coins per 1 FLOWER')} <i class="fa-solid fa-sort"></i>`;

        const fetchBtn = document.querySelector('#btn-fetch');
        if(fetchBtn) fetchBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${t('Sync')}`;

        const searchInput = document.querySelector('#searchInput');
        if(searchInput) searchInput.placeholder = t('Search');

        if(document.getElementById('tab-all')) document.getElementById('tab-all').innerText = t('All');
        if(document.getElementById('tab-crops')) document.getElementById('tab-crops').innerText = t('Crops');
        if(document.getElementById('tab-fruits')) document.getElementById('tab-fruits').innerText = t('Fruits');
        if(document.getElementById('tab-greenhouse')) document.getElementById('tab-greenhouse').innerText = t('Greenhouse');

        this._updateFooterTime();
    }

    _updateFooterTime() {
        const el = document.getElementById('last-updated');
        if (!el || !this.lastUpdateTime) return;
        const lang = this.i18n.getLang() === 'zh' ? 'zh-CN' : 'en-US';
        const timeStr = this.lastUpdateTime.toLocaleString(lang);
        el.innerHTML = `${this.i18n.t('Last Updated')}: ${timeStr}`;
    }

    toggleBonus() {
        const bonus5 = document.getElementById('bonus5')?.checked || false;
        const bonus10 = document.getElementById('bonus10')?.checked || false;
        localStorage.setItem('sfl_bonus5', bonus5);
        localStorage.setItem('sfl_bonus10', bonus10);
        if (this.cachedP2P && this.cachedShop) {
            this.triggerCalculation();
        }
    }

    triggerCalculation() {
        const bonus5 = document.getElementById('bonus5')?.checked || false;
        const bonus10 = document.getElementById('bonus10')?.checked || false;
        this.rawData = this.logic.Calculate(this.cachedP2P, this.cachedShop, bonus5, bonus10);
        this.filterData();
    }

    updatePrice(name, inputValue) {
        const item = this.rawData.find(i => i.name === name);
        if (!item) return;

        if (inputValue === "" || inputValue === null) {
            item.p2p = item.originalP2p;
            item.isCustom = false;
        } else {
            const val = parseFloat(inputValue);
            if (!isNaN(val) && val >= 0) {
                item.p2p = val;
                item.isCustom = true;
            }
        }
        this.logic.RecalculateItem(item);
        this.filterData();
    }

    setCategory(cat) {
        this.currentCategory = cat;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        let activeId = 'tab-all';
        if (cat === 'Crops') activeId = 'tab-crops';
        else if (cat === 'Fruits') activeId = 'tab-fruits';
        else if (cat === 'Greenhouse') activeId = 'tab-greenhouse';
        
        const activeBtn = document.getElementById(activeId);
        if(activeBtn) activeBtn.classList.add('active');
        
        this.filterData();
    }

    sortTable(field) {
        if (this.sortField === field) {
            this.sortDesc = !this.sortDesc;
        } else {
            this.sortField = field;
            this.sortDesc = true;
        }
        this.filterData();
    }

    filterData() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return; 
        const search = searchInput.value.toLowerCase();
        
        let filtered = this.rawData.filter(item => {
            const displayName = this.i18n.t(item.name).toLowerCase();
            return (this.currentCategory === 'All' || item.category === this.currentCategory) &&
                   displayName.includes(search);
        });

        filtered.sort((a, b) => {
            if (this.sortField === 'name') {
                const nameA = this.i18n.t(a.name);
                const nameB = this.i18n.t(b.name);
                return this.sortDesc ? nameB.localeCompare(nameA, 'zh') : nameA.localeCompare(nameB, 'zh');
            }
            let valA = a[this.sortField];
            let valB = b[this.sortField];
            return this.sortDesc ? valB - valA : valA - valB;
        });

        this._renderTable(filtered);
    }

    _renderTable(data) {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px;">无数据</td></tr>`;
            return;
        }
        data.forEach(item => {
            const tr = document.createElement('tr');
            const fmt = (n) => n < 0.01 ? n.toFixed(5) : n.toFixed(4);
            const fmtInt = (n) => Math.round(n).toLocaleString();
            let ratioColor = '#666';
            let ratioWeight = 'normal';
            if (item.ratio >= 320) { ratioColor = '#40c057'; ratioWeight = 'bold'; } 
            else if (item.ratio > 0) { ratioColor = '#fa5252'; ratioWeight = 'bold'; } 
            
            const inputStyle = `
                background: transparent;
                border: 1px solid ${item.isCustom ? '#fab005' : 'transparent'};
                color: ${item.isCustom ? '#fab005' : 'inherit'};
                width: 100px; padding: 4px; border-radius: 4px; font-family: monospace;
            `;
            
            let rawName = item.name.toLowerCase().replace(/\s+/g, '-');
            const iconName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            const iconUrl = `https://sfl.world/img/source/${iconName}.png`;

            tr.innerHTML = `
                <td style="font-weight:bold; color:var(--primary)">
                    <img src="${iconUrl}" class="item-icon" alt="${item.name}" onerror="this.style.display='none'">
                    ${this.i18n.t(item.name)}
                </td>
                <td>
                    <input type="number" step="0.0001" style="${inputStyle}" class="p2p-input"
                           value="${item.p2p > 0 ? item.p2p : ''}" placeholder="0.00"
                           onchange="app.updatePrice('${item.name}', this.value)">
                </td>
                <td style="color:#888">${item.sellPrice > 0 ? fmt(item.sellPrice) : '-'}</td>
                <td style="font-size:1.1em; color:${ratioColor}; font-weight:${ratioWeight}">
                    ${item.ratio > 0 ? fmtInt(item.ratio) + '' : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    _setLoading(isLoading) { 
        const btn = document.getElementById('btn-fetch');
        if(btn) btn.disabled = isLoading; 
    }
    _setStatus(msg, isError) {
        const el = document.getElementById('status-bar');
        if(el) {
            el.innerHTML = msg;
            el.style.color = isError ? '#fa5252' : '#888';
        }
    }
}