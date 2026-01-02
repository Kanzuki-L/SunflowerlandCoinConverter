import { NetworkService } from './services/NetworkService.js';
import { ParserService } from './services/ParserService.js';
import { I18nService } from './services/I18nService.js';
import { CoreLogic } from './core/CoreLogic.js';
import { UiView } from './view/UiView.js';
import { AnalyticsService } from './services/AnalyticsService.js';

export class AppController {
    constructor() {
        this.net = new NetworkService();
        this.parser = new ParserService();
        this.i18n = new I18nService();
        this.logic = new CoreLogic();
        this.view = new UiView();
        this.analytics = new AnalyticsService();

        this.rawData = [];
        this.cachedP2P = null;
        this.cachedShop = null;
        this.lastUpdateTime = null;

        this.currentCategory = 'All';
        this.sortField = 'ratio';
        this.sortDesc = true;

        this.view.bindSyncData(() => this.fetchData());
        this.view.bindSearch((val) => this.filterData(val));
        this.view.bindChangeLanguage((lang) => this.changeLanguage(lang));
        this.view.bindToggleBonus(() => this.toggleBonus());
        this.view.bindCategoryChange((cat) => this.setCategory(cat));
        this.view.bindSort((field) => this.sortTable(field));
        this.view.bindSyncData(() => {
            this.fetchData();
            this.analytics.logEvent('click_sync');
        });
        this.view.bindCategoryChange((cat) => {
            this.setCategory(cat);
            this.analytics.logEvent('view_category', { category_name: cat });
        });
    }

    async fetchData() {
        this._setLoading(true);
        try {
            const [p2p, cropsTS, fruitsTS] = await Promise.all([
                this.net.fetchData("https://sfl.world/api/v1/prices"),
                this.net.fetchData("https://raw.githubusercontent.com/sunflower-land/sunflower-land/refs/heads/main/src/features/game/types/crops.ts"),
                this.net.fetchData("https://raw.githubusercontent.com/sunflower-land/sunflower-land/refs/heads/main/src/features/game/types/fruits.ts")
            ]);

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
                this.lastUpdateTime = new Date(Number(timestamp));
            } else {
                this.lastUpdateTime = new Date();
            }

            this._loadBonusSettings();
            this.triggerCalculation();

            const msg = `${this.i18n.t('Update Success')}: ${this.rawData.length} ${this.i18n.t('items')}`;
            this.view.updateStatus(msg, false);

            this._refreshUI();

        } catch (e) {
            console.error(e);
            this.view.updateStatus(this.i18n.t('Update Failed'), true);
        } finally {
            this._setLoading(false);
        }
    }

    _loadBonusSettings() {
        const b5 = localStorage.getItem('sfl_bonus5') === 'true';
        const b10 = localStorage.getItem('sfl_bonus10') === 'true';
        this.view.setBonusState(b5, b10);
    }

    changeLanguage(langCode) {
        this.i18n.setLanguage(langCode);
        this._refreshUI();
        this.filterData();
        this._updateStatusMsg();
    }

    _refreshUI() {
        const t = (k) => this.i18n.t(k);
        this.view.updateUILabels(t, this.i18n.getLang());
        this.view.updateFooterTime(this.lastUpdateTime, this.i18n.getLang(), t);
    }

    _updateStatusMsg() {
        const t = (k) => this.i18n.t(k);
        if (this.rawData.length > 0) {
            const msg = `${t('Update Success')}: ${this.rawData.length} ${t('items')}`;
            this.view.updateStatus(msg, false);
        } else {
            this.view.updateStatus(t('Ready'), false);
        }
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
        this.view.setCategoryActive(cat);
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

    filterData(searchValue) {
        if (searchValue === undefined) {
            searchValue = document.getElementById('searchInput')?.value || '';
        }
        const search = searchValue.toLowerCase();

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

        this.view.renderTable(filtered, (k) => this.i18n.t(k), (name, val) => this.updatePrice(name, val));
    }

    _setLoading(isLoading) {
        const btn = document.getElementById('btn-fetch');
        if (btn) btn.disabled = isLoading;
    }
}