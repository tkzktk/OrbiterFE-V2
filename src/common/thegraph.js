import axios from 'axios';
import util from "../util/util";
import BigNumber from "bignumber.js";

let v3ChainList = [];

export async function getMdcRuleLatest(dealerAddress) {
    if (!new RegExp(/^0x[a-fA-F0-9]{40}$/).test(dealerAddress)) {
        return null;
    }
    const thegraphApi = process.env.VUE_APP_THEGRAPH_API;
    if (!thegraphApi) {
        return null;
    }
    const res = await axios.post(thegraphApi, {
        query: `{
        chainRels {
            id
            tokens {
              tokenAddress
            }
            nativeToken
          }
        dealer(id: "${ dealerAddress }") {
            mdcs {
            id
            owner
            mapping {
              chainIdMapping {
                chainId
                chainIdIndex
              }
              dealerMapping {
                dealerAddr
                dealerIndex
              }
              ebcMapping {
                ebcAddr
                ebcIndex
              }
            }
            ruleLatest {
              latestUpdateTimestamp
              ebc {
                id
              }
              id
              chain0
              chain0ResponseTime
              chain0Status
              chain0Token
              chain0TradeFee
              chain0WithholdingFee
              chain0maxPrice
              chain0minPrice
              chain1
              chain1CompensationRatio
              chain1ResponseTime
              chain1Status
              chain1Token
              chain1TradeFee
              chain1WithholdingFee
              chain1maxPrice
              chain1minPrice
              ruleValidation
            }
          }
        }
      }`
    });
    const responese = res.data?.data;
    if (!responese?.dealer || !responese?.chainRels) return null;
    convertV3ChainList(responese.chainRels);
    const mdcs = responese.dealer.mdcs || [];
    const marketList = [];
    for (const mdc of mdcs) {
        const chainIdMap = {};
        if (!mdc?.mapping?.chainIdMapping?.length) continue;
        for (const chainIdData of mdc.mapping.chainIdMapping) {
            chainIdMap[chainIdData.chainId] = chainIdData.chainIdIndex;
        }
        const ruleLatests = mdc.ruleLatest;
        for (const ruleLatest of ruleLatests) {
            const ebcId = mdc.mapping.ebcMapping.find(item => item.ebcAddr === ruleLatest.ebc.id)?.ebcIndex;
            if (!ebcId) {
                continue;
            }
            if (!ruleLatest.ruleValidation) continue;
            const dealerId = mdc.mapping.dealerMapping.find(item => item.dealerAddr === dealerAddress)?.dealerIndex;
            if (ruleLatest.chain0Status) {
                const token0 = getTokenByTokenAddress(String(ruleLatest.chain0), ruleLatest.chain0Token);
                const token1 = getTokenByTokenAddress(String(ruleLatest.chain1), ruleLatest.chain1Token);
                const chainInfo0 = v3ChainList.find(item=>item.chainId === String(ruleLatest.chain0));
                const chainInfo1 = v3ChainList.find(item=>item.chainId === String(ruleLatest.chain1));
                if (!token0 || !token0) {
                    // util.log("none of token", ruleLatest.chain0, ruleLatest.chain0Token, ruleLatest.chain1, ruleLatest.chain1Token);
                    continue;
                }
                marketList.push({
                    dealerId,
                    ebcId,
                    recipient: mdc.owner,
                    sender: mdc.owner,
                    spentTime: ruleLatest.chain0ResponseTime,
                    fromChain: {
                        id: chainIdMap[ruleLatest.chain0],
                        networkId: ruleLatest.chain0,
                        chainId: ruleLatest.chain0,
                        name: chainInfo0.name,
                        symbol: token0.symbol,
                        tokenAddress: ruleLatest.chain0Token,
                        decimals: token0.decimals,
                        maxPrice: floor(Number(new BigNumber(ruleLatest.chain0maxPrice).dividedBy(10 ** token0.decimals))),
                        minPrice: ceil(Number(new BigNumber(ruleLatest.chain0minPrice || 0).dividedBy(10 ** token0.decimals))),
                    },
                    toChain: {
                        id: chainIdMap[ruleLatest.chain1],
                        networkId: ruleLatest.chain1,
                        chainId: ruleLatest.chain1,
                        name: chainInfo1.name,
                        symbol: token1.symbol,
                        tokenAddress: ruleLatest.chain1Token,
                        decimals: token1.decimals,
                    },
                    gasFee: new BigNumber(ruleLatest.chain0TradeFee).multipliedBy(10).toFixed(),
                    tradingFee: new BigNumber(ruleLatest.chain0WithholdingFee).dividedBy(10 ** token0.decimals).toFixed(),
                    times: [0, 99999999999999],
                });
            }
            if (ruleLatest.chain1Status) {
                const token0 = getTokenByTokenAddress(Number(ruleLatest.chain0), ruleLatest.chain0Token);
                const token1 = getTokenByTokenAddress(Number(ruleLatest.chain1), ruleLatest.chain1Token);
                const chainInfo0 = v3ChainList.find(item=>item.chainId === String(ruleLatest.chain0));
                const chainInfo1 = v3ChainList.find(item=>item.chainId === String(ruleLatest.chain1));
                if (!token0 || !token0) {
                    // util.log("none of token", ruleLatest.chain0, ruleLatest.chain0Token, ruleLatest.chain1, ruleLatest.chain1Token);
                    continue;
                }
                marketList.push({
                    dealerId,
                    ebcId,
                    recipient: mdc.owner,
                    sender: mdc.owner,
                    spentTime: ruleLatest.chain1ResponseTime,
                    fromChain: {
                        id: Number(chainIdMap[ruleLatest.chain1]),
                        networkId: ruleLatest.chain1,
                        chainId: ruleLatest.chain1,
                        name: chainInfo1.name,
                        symbol: token1?.symbol,
                        tokenAddress: ruleLatest.chain1Token,
                        decimals: token1?.decimals,
                        maxPrice: floor(Number(new BigNumber(ruleLatest.chain1maxPrice).dividedBy(10 ** token1.decimals))),
                        minPrice: ceil(Number(new BigNumber(ruleLatest.chain1minPrice || 0).dividedBy(10 ** token1.decimals))),
                    },
                    toChain: {
                        id: Number(chainIdMap[ruleLatest.chain0]),
                        networkId: ruleLatest.chain0,
                        chainId: ruleLatest.chain0,
                        name: chainInfo0.name,
                        symbol: token0?.symbol,
                        tokenAddress: ruleLatest.chain0Token,
                        decimals: token0?.decimals,
                    },
                    gasFee: new BigNumber(ruleLatest.chain1TradeFee).multipliedBy(10).toFixed(),
                    tradingFee: new BigNumber(ruleLatest.chain1WithholdingFee).dividedBy(10 ** token1.decimals).toFixed(),
                    times: [0, 99999999999999],
                });
            }
        }
    }
    return marketList;
}

function convertV3ChainList(chainRels) {
    v3ChainList = [];
    for (const chain of chainRels) {
        const v3Tokens = chain.tokens;
        if (!chain.id || !v3Tokens?.length) continue;
        const v3ChainInfo = util.getV3ChainInfoByChainId(chain.id);
        if (!v3ChainInfo) continue;
        const newV3ChainInfo = JSON.parse(JSON.stringify(v3ChainInfo));
        if (chain.nativeToken.toLowerCase() !== util.starknetHashFormat(newV3ChainInfo.nativeCurrency.address)) {
            newV3ChainInfo.nativeCurrency = {};
        }
        const newTokens = [];
        for (const token of newV3ChainInfo.tokens) {
            if (v3Tokens.find(item => item.tokenAddress.toLowerCase() === util.starknetHashFormat(token.address).toLowerCase())) {
                newTokens.push(token);
            }
        }
        newV3ChainInfo.tokens = newTokens;
        v3ChainList.push(newV3ChainInfo);
    }
    util.log('v3ChainList', v3ChainList);
}

function getTokenByTokenAddress(chainId, tokenAddress) {
    const chainInfo = v3ChainList.find(item => item.chainId === String(chainId));
    if (!chainInfo) return null;
    const tokenList = getChainTokenList(chainInfo);
    return tokenList.find(item => util.starknetHashFormat(item.address).toLowerCase() === tokenAddress.toLowerCase());
}

function getChainTokenList(chain) {
    const allTokenList = [];
    if (!chain) return [];
    if (chain.tokens && chain.tokens.length) {
        allTokenList.push(...chain.tokens);
    }
    if (chain.nativeCurrency) {
        allTokenList.push(chain.nativeCurrency);
    }
    return allTokenList;
}

function ceil(n) {
    return Number(new BigNumber(Math.ceil(n * 10 ** 6)).dividedBy(10 ** 6));
}

function floor(n) {
    return Number(new BigNumber(Math.floor(n * 10 ** 6)).dividedBy(10 ** 6));
}