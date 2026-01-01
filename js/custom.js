class NetworkService {
    constructor() { this._proxyUrl = "./proxy.php"; }
    async _FetchData(url) {
        try {
            const res = await fetch(`${this._proxyUrl}?url=${encodeURIComponent(url)}&t=${Date.now()}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            return json; 
        } catch (e) {
            console.error(`Fetch Error (${url}):`, e);
            throw e;
        }
    }
}

class ParserService {
    ParseTS(content) {
        if (typeof content !== 'string') {
            if (content && content.content) content = content.content;
            else return {};
        }

        const items = {};
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace === -1) return {};

        const innerContent = content.substring(firstBrace + 1, lastBrace);

        let depth = 0;
        let buffer = '';
        const itemBlocks = [];

        for (let i = 0; i < innerContent.length; i++) {
            const char = innerContent[i];
            if (char === '{') depth++;
            if (char === '}') depth--;
            buffer += char;
            if (depth === 0 && char === ',') {
                if (buffer.trim().length > 5) itemBlocks.push(buffer);
                buffer = '';
            }
        }
        if (buffer.trim().length > 5) itemBlocks.push(buffer);

        itemBlocks.forEach(block => {
            const nameMatch = block.match(/['"]?([\w\s]+)['"]?\s*:\s*\{/);
            if (!nameMatch) return;
            const name = nameMatch[1].trim();

            let sellPrice = 0;
            const sellMatch = block.match(/sellPrice\s*:\s*([\d\.]+)/);
            if (sellMatch) {
                sellPrice = parseFloat(sellMatch[1]);
            } else {
                const marketMatch = block.match(/sellPrice\s*:\s*marketRate\(([\d\.]+)\)/);
                if (marketMatch) sellPrice = parseFloat(marketMatch[1]);
            }

            let xp = 0;
            const xpMatch = block.match(/\bxp\s*:\s*([\d\.]+)/);
            if (xpMatch) xp = parseFloat(xpMatch[1]);

            if (sellPrice > 0 || xp > 0) {
                items[name] = { sellPrice, xp };
            }
        });

        return items;
    }
}

class CoreLogic {
    constructor() {
        this.categories = {
            'Crops': ["Sunflower", "Potato", "Pumpkin", "Carrot", "Cabbage", "Beetroot", "Cauliflower", "Parsnip", "Eggplant", "Corn", "Radish", "Wheat", "Kale", "Soybean", "Barley", "Rhubarb", "Zucchini", "Yam", "Broccoli", "Pepper", "Onion", "Turnip", "Artichoke"],
            'Fruits': ["Apple", "Blueberry", "Orange", "Banana", "Tomato", "Lemon","Celestine","Lunara","Duskberry"],
            'Greenhouse': ["Grape", "Rice", "Olive"]
        };
    }

    Calculate(p2pData, shopData, isBonus5, isBonus10) {
        let items = [];
        const sourceP2P = p2pData?.data?.p2p || p2pData?.p2p || p2pData || {};
        
        const shopMap = new Map();
        Object.keys(shopData).forEach(k => shopMap.set(k.toLowerCase().trim(), shopData[k]));

        const allKeys = new Set([...this.categories.Crops, ...this.categories.Fruits, ...this.categories.Greenhouse]);
        
        allKeys.forEach(name => {
            const lowerName = name.toLowerCase();
            const p2pKey = Object.keys(sourceP2P).find(k => k.toLowerCase() === lowerName);
            const p2pPrice = p2pKey ? parseFloat(sourceP2P[p2pKey]) : 0;
            const shopInfo = shopMap.get(lowerName) || { sellPrice: 0, xp: 0 };

            if (shopInfo.sellPrice > 0 || shopInfo.xp > 0 || p2pPrice > 0) {
                let cat = 'Other';
                if (this.categories.Crops.includes(name)) cat = 'Crops';
                else if (this.categories.Fruits.includes(name)) cat = 'Fruits';
                else if (this.categories.Greenhouse.includes(name)) cat = 'Greenhouse';

                let finalSellPrice = shopInfo.sellPrice;

                if (cat === 'Crops') {
                    if (isBonus5) finalSellPrice = finalSellPrice * 1.05;
                    if (isBonus10) finalSellPrice = finalSellPrice * 1.10;
                }

                const safeP2P = p2pPrice > 0 ? p2pPrice : 0;
                let ratio = 0;
                if (finalSellPrice > 0 && safeP2P > 0) {
                    ratio = finalSellPrice / safeP2P;
                }

                let efficiency = 0;
                if (shopInfo.xp > 0 && safeP2P > 0) {
                    efficiency = shopInfo.xp / safeP2P;
                }

                items.push({
                    name: name,
                    category: cat,
                    originalP2p: safeP2P,
                    p2p: safeP2P,
                    isCustom: false,
                    xp: shopInfo.xp,
                    sellPrice: finalSellPrice,
                    baseSellPrice: shopInfo.sellPrice, 
                    efficiency: efficiency,
                    ratio: ratio
                });
            }
        });
        return items;
    }

    RecalculateItem(item) {
        if (item.p2p > 0) {
            item.ratio = item.sellPrice > 0 ? item.sellPrice / item.p2p : 0;
            item.efficiency = item.xp > 0 ? item.xp / item.p2p : 0;
        } else {
            item.ratio = 0;
            item.efficiency = 0;
        }
        return item;
    }
}

class AppController {
    constructor() {
        this.net = new NetworkService();
        this.parser = new ParserService();
        this.logic = new CoreLogic();
        
        this.rawData = [];
        this.cachedP2P = null; 
        this.cachedShop = null; 
        
        this.currentCategory = 'All';
        this.sortField = 'ratio'; 
        this.sortDesc = true;     
        this.UpdatePrice = this.UpdatePrice.bind(this);
    }

    async FetchData() {
        this._SetLoading(true);
        try {
            const [p2p, cropsTS, fruitsTS] = await Promise.all([
                this.net._FetchData("https://sfl.world/api/v1/prices"),
                this.net._FetchData("https://raw.githubusercontent.com/sunflower-land/sunflower-land/refs/heads/main/src/features/game/types/crops.ts"),
                this.net._FetchData("https://raw.githubusercontent.com/sunflower-land/sunflower-land/refs/heads/main/src/features/game/types/fruits.ts")
            ]);

            const cropsContent = cropsTS.content || cropsTS;
            const fruitsContent = fruitsTS.content || fruitsTS;

            const cropsParsed = this.parser.ParseTS(cropsContent);
            const fruitsParsed = this.parser.ParseTS(fruitsContent);
            
            this.cachedShop = { ...cropsParsed, ...fruitsParsed };
            this.cachedP2P = p2p;

            this.TriggerCalculation();
            
            this._SetStatus(`更新成功: ${this.rawData.length} 条数据`);
        } catch (e) {
            console.error(e);
            this._SetStatus("更新失败", true);
        } finally {
            this._SetLoading(false);
        }
    }

    ToggleBonus() {
        if (this.cachedP2P && this.cachedShop) {
            this.TriggerCalculation();
        }
    }

    TriggerCalculation() {
        const bonus5 = document.getElementById('bonus5').checked;
        const bonus10 = document.getElementById('bonus10').checked;

        this.rawData = this.logic.Calculate(this.cachedP2P, this.cachedShop, bonus5, bonus10);
        
        this.FilterData();
    }

    UpdatePrice(name, inputValue) {
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
        this.FilterData();
    }

    SetCategory(cat) {
        this.currentCategory = cat;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.innerText.includes(cat) || (cat === 'All' && btn.innerText.includes('全部')));
        });
        this.FilterData();
    }

    SortTable(field) {
        if (this.sortField === field) {
            this.sortDesc = !this.sortDesc;
        } else {
            this.sortField = field;
            this.sortDesc = true;
        }
        this.FilterData();
    }

    FilterData() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        let filtered = this.rawData.filter(item => {
            return (this.currentCategory === 'All' || item.category === this.currentCategory) &&
                   item.name.toLowerCase().includes(search);
        });

        filtered.sort((a, b) => {
            let valA = a[this.sortField];
            let valB = b[this.sortField];
            return this.sortDesc ? valB - valA : valA - valB;
        });

        this._RenderTable(filtered);
    }

    _RenderTable(data) {
        const tbody = document.getElementById('tableBody');
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
            if (item.ratio >= 320) { 
                ratioColor = '#40c057'; ratioWeight = 'bold'; 
            } else if (item.ratio > 0) { 
                ratioColor = '#fa5252'; ratioWeight = 'bold'; 
            } 
            
            const inputStyle = `
                background: transparent;
                border: 1px solid ${item.isCustom ? '#fab005' : 'transparent'};
                color: ${item.isCustom ? '#fab005' : 'inherit'};
                width: 100px;
                padding: 4px;
                border-radius: 4px;
                font-family: monospace;
            `;
            
            tr.innerHTML = `
                <td style="font-weight:bold; color:var(--primary)">${item.name}</td>
                <td>
                    <input type="number" step="0.0001" 
                           style="${inputStyle}"
                           class="p2p-input"
                           value="${item.p2p > 0 ? item.p2p : ''}" 
                           placeholder="0.00"
                           onchange="app.UpdatePrice('${item.name}', this.value)">
                </td>
                <td style="color:#888">${item.sellPrice > 0 ? fmt(item.sellPrice) : '-'}</td>
                <td style="font-size:1.1em; color:${ratioColor}; font-weight:${ratioWeight}">
                    ${item.ratio > 0 ? fmtInt(item.ratio) + '' : '-'}
                </td>
                <td style="font-size:0.9em; color:#888">
                    ${item.efficiency > 0 ? fmtInt(item.efficiency) : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    _SetLoading(isLoading) { document.getElementById('btn-fetch').disabled = isLoading; }
    _SetStatus(msg, isError) {
        const el = document.getElementById('status-bar');
        el.innerHTML = msg;
        el.style.color = isError ? '#fa5252' : '#888';
    }
}

const app = new AppController();
app.FetchData();