export class ParserService {
    parseTS(content) {
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

            let coin = 0;
            const coinMatch = block.match(/\bcoin\s*:\s*([\d\.]+)/);
            if (coinMatch) {
                coin = parseFloat(coinMatch[1]);
            } else {
                const coinsMatch = block.match(/coin\s*:\s*([\d\.]+)/);
                if (coinsMatch) coin = parseFloat(coinsMatch[1]);
            }

            if (sellPrice > 0 || coin > 0) {
                items[name] = { sellPrice, coin };
            }
        });

        return items;
    }
}