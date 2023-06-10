const { ethers, JsonRpcProvider } = require('ethers');
let swiftGateAbi = require("./SwiftGate.json").abi;
require("dotenv").config();

const swiftGateAddress = "0x7374Da744DD2b54e50b933692f471B6395023B12";
const rpcUrlScroll = process.env.RPC_URL_SCROLL;
const rpcUrlOptimism = process.env.RPC_URL_OPTIMISM;
const batchSize = 5;
const privateKey = process.env.PRIVATE_KEY;

const swiftGateScroll = new ethers.Contract(swiftGateAddress, swiftGateAbi, new JsonRpcProvider(rpcUrlScroll));
const swiftGateOptimism = new ethers.Contract(swiftGateAddress, swiftGateAbi, new JsonRpcProvider(rpcUrlOptimism));

const chainIdToRpcUrl = {
    1: rpcUrlScroll,
    2: rpcUrlOptimism
}

const numSignatures = 13;
let governorPKs = [];
let governors = [];
for(i = 11; i < numSignatures + 11; i++) { 
    governorPKs.push(i);
    governors.push(new ethers.BaseWallet(new ethers.SigningKey(ethers.solidityPacked(["uint256"], [i]))));
}

async function onSwiftSend(contract, srcChain) {
    contract.on("SwiftSend", async (token_, amount_, receiver_, dstChain_, isSingle_) => {
        console.log("SwiftSend " + token_ + " " + amount_ + " " + receiver_ + " " + dstChain_ + " " + isSingle_);
        try {
            await swiftReceive([token_], [amount_], [receiver_], [srcChain], [dstChain_]);
        } catch (error) {
            console.log(error);
        }
    });
}

async function swiftReceive(tokens, amounts, receivers, srcChains, dstChains) {
    const salt = ethers.solidityPacked(["uint256"], [Date.now()]);
    let messageHash = salt;
    let params = [];
    for (i = 0; i < tokens.length; i++) {
        params.push({token: tokens[i], amount: amounts[i], receiver: receivers[i], srcChain: srcChains[i], dstChain: dstChains[i]});
        messageHash = ethers.solidityPackedKeccak256(
            ["bytes32", "address", "uint256", "address", "uint16", "uint16"], 
            [messageHash, params[i].token, params[i].amount, params[i].receiver, params[i].srcChain, params[i].dstChain]);
    }
    let signatures = signMessage(messageHash);

    const rpcUrl = chainIdToRpcUrl[dstChains[0]];
    const wallet = new ethers.Wallet(privateKey, new JsonRpcProvider(rpcUrl));
    const contract = new ethers.Contract(swiftGateAddress, swiftGateAbi, wallet);

    await contract.swiftReceive(params, signatures, salt);
    nonce++;
}

function signMessage(messageHash) {
    let signatures = [];
    for (i = 0; i < governors.length; i++) {
        let signature = governors[i].signingKey.sign(messageHash);
        signatures.push({v: signature.yParity + 27, r: signature.r, s: signature.s});
    }
    return signatures;
}

onSwiftSend(swiftGateScroll, 1);
onSwiftSend(swiftGateOptimism, 2);