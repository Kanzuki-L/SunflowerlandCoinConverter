export class UiView {
    constructor() {
        this.elements = {
            searchInput: document.getElementById('searchInput'),
            tableBody: document.getElementById('tableBody'),
            bonus5: document.getElementById('bonus5'),
            bonus10: document.getElementById('bonus10'),
            btnFetch: document.getElementById('btn-fetch'),
            langSelect: document.getElementById('langSelect'),
            footerTime: document.getElementById('last-updated'),
            statusBar: document.getElementById('status-bar'),
            tabs: document.querySelectorAll('.tab-btn'),
            thItem: document.getElementById('th-item'),
            thP2p: document.getElementById('th-p2p'),
            thShop: document.getElementById('th-shop'),
            thRatio: document.getElementById('th-ratio')
        };
    }

    bindSyncData(handler) {
        if (this.elements.btnFetch) {
            this.elements.btnFetch.addEventListener('click', handler);
        }
    }

    bindSearch(handler) {
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('keyup', (e) => handler(e.target.value));
        }
    }

    bindChangeLanguage(handler) {
        if (this.elements.langSelect) {
            this.elements.langSelect.addEventListener('change', (e) => handler(e.target.value));
        }
    }

    bindToggleBonus(handler) {
        if (this.elements.bonus5) this.elements.bonus5.addEventListener('change', handler);
        if (this.elements.bonus10) this.elements.bonus10.addEventListener('change', handler);
    }

    bindCategoryChange(handler) {
        this.elements.tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.id.replace('tab-', '');
                const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
                handler(formattedCat);
            });
        });
    }

    bindSort(handler) {
        if (this.elements.thItem) this.elements.thItem.addEventListener('click', () => handler('name'));
        if (this.elements.thP2p) this.elements.thP2p.addEventListener('click', () => handler('p2p'));
        if (this.elements.thShop) this.elements.thShop.addEventListener('click', () => handler('sellPrice'));
        if (this.elements.thRatio) this.elements.thRatio.addEventListener('click', () => handler('ratio'));
    }

    renderTable(data, tFunc, onPriceChange) {
        const tbody = this.elements.tableBody;
        if (!tbody) return;

        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px;">No Data</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        data.forEach(item => {
            const tr = document.createElement('tr');

            const fmt = (n) => n < 0.01 ? n.toFixed(5) : n.toFixed(4);
            const fmtInt = (n) => Math.round(n).toLocaleString();

            let ratioClass = 'ratio-normal';
            if (item.ratio >= 320) ratioClass = 'ratio-high';
            else if (item.ratio > 0) ratioClass = 'ratio-low';

            const inputClass = item.isCustom ? 'p2p-input is-custom' : 'p2p-input';

            let rawName = item.name.toLowerCase().replace(/\s+/g, '-');
            const iconName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            const iconUrl = `https://sfl.world/img/source/${iconName}.png`;

            tr.innerHTML = `
                <td class="cell-name">
                    <img src="${iconUrl}" class="item-icon" alt="${item.name}" onerror="this.style.display='none'">
                    ${tFunc(item.name)}
                </td>
                <td>
                    <input type="number" step="0.0001" class="${inputClass}"
                           value="${item.p2p > 0 ? item.p2p : ''}" placeholder="0.00">
                </td>
                <td class="cell-sell">${item.sellPrice > 0 ? fmt(item.sellPrice) : '-'}</td>
                <td class="cell-ratio ${ratioClass}">
                    ${item.ratio > 0 ? fmtInt(item.ratio) + ' ' + tFunc('Coins') : '-'}
                </td>
            `;

            const input = tr.querySelector('.p2p-input');
            input.addEventListener('change', (e) => {
                onPriceChange(item.name, e.target.value);
            });

            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    }

    updateStatus(msg, isError) {
        const el = this.elements.statusBar;
        if (el) {
            el.innerHTML = msg;
            el.style.color = isError ? '#fa5252' : '';
        }
    }

    updateFooterTime(lastUpdateTime, langCode, tFunc) {
        const el = this.elements.footerTime;
        if (!el || !lastUpdateTime) return;

        const localeMap = { 'zh': 'zh-CN', 'en': 'en-US', 'jp': 'ja-JP', 'pt': 'pt-BR' };
        const locale = localeMap[langCode] || 'en-US';
        const timeStr = lastUpdateTime.toLocaleString(locale);

        el.innerHTML = `${tFunc('Last Updated')}: ${timeStr}`;
    }

    updateUILabels(tFunc, currentLang) {
        if (this.elements.langSelect) this.elements.langSelect.value = currentLang;

        if (this.elements.thItem) this.elements.thItem.innerHTML = `${tFunc('Item')} <i class="fa-solid fa-sort"></i>`;
        if (this.elements.thP2p) this.elements.thP2p.innerHTML = `${tFunc('P2P Price')} <i class="fa-solid fa-sort"></i>`;
        if (this.elements.thShop) this.elements.thShop.innerHTML = `${tFunc('Betty Price')} <i class="fa-solid fa-sort"></i>`;
        if (this.elements.thRatio) this.elements.thRatio.innerHTML = `${tFunc('Coins per 1 FLOWER')} <i class="fa-solid fa-sort"></i>`;

        if (this.elements.btnFetch) this.elements.btnFetch.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${tFunc('Sync')}`;
        if (this.elements.searchInput) this.elements.searchInput.placeholder = tFunc('Search');

        const tabMap = { 'tab-all': 'All', 'tab-crops': 'Crops', 'tab-fruits': 'Fruits', 'tab-greenhouse': 'Greenhouse' };
        for (const [id, key] of Object.entries(tabMap)) {
            const el = document.getElementById(id);
            if (el) el.innerText = tFunc(key);
        }
    }

    setCategoryActive(cat) {
        this.elements.tabs.forEach(btn => btn.classList.remove('active'));
        let activeId = 'tab-all';
        if (cat === 'Crops') activeId = 'tab-crops';
        else if (cat === 'Fruits') activeId = 'tab-fruits';
        else if (cat === 'Greenhouse') activeId = 'tab-greenhouse';

        const activeBtn = document.getElementById(activeId);
        if (activeBtn) activeBtn.classList.add('active');
    }

    setBonusState(b5, b10) {
        if (this.elements.bonus5) this.elements.bonus5.checked = b5;
        if (this.elements.bonus10) this.elements.bonus10.checked = b10;
    }
}