const { ethers, JsonRpcProvider, WebSocketProvider } = require('ethers');
let swiftGateAbi = require("./SwiftGate.json").abi;
require("dotenv").config();

const swiftGateAddress = "0xB84f07612F4bfEc42E042b6CDD26df496b3d397f";
const rpcUrlOptimism = process.env.RPC_URL_OPTIMISM_GOERLI;
const rpcUrlScroll = process.env.RPC_URL_SCROLL_ALPHA;
const rpcUrlChiado = process.env.RPC_URL_CHIADO;
const rpcUrlMantle = process.env.RPC_URL_MANTLE;
const rpcUrlTaiko = process.env.RPC_URL_TAIKO;

const privateKey = process.env.PRIVATE_KEY;

const optimismWallet = new ethers.Wallet(privateKey, new JsonRpcProvider(rpcUrlOptimism));
const scrollWallet = new ethers.Wallet(privateKey, new JsonRpcProvider(rpcUrlScroll));
const chiadoWallet = new ethers.Wallet(privateKey, new JsonRpcProvider(rpcUrlChiado));
const mantleWallet = new ethers.Wallet(privateKey, new JsonRpcProvider(rpcUrlMantle));
const taikoWallet = new ethers.Wallet(privateKey, new JsonRpcProvider(rpcUrlTaiko));

const swiftGateOptimism = new ethers.Contract(swiftGateAddress, swiftGateAbi, optimismWallet);
const swiftGateScroll = new ethers.Contract(swiftGateAddress, swiftGateAbi, scrollWallet);
const swiftGateChiado = new ethers.Contract(swiftGateAddress, swiftGateAbi, chiadoWallet);
const swiftGateMantle = new ethers.Contract(swiftGateAddress, swiftGateAbi, mantleWallet);
const swiftGateTaiko = new ethers.Contract(swiftGateAddress, swiftGateAbi, taikoWallet);

const chainIdToContract = {
    1: swiftGateOptimism,
    2: swiftGateScroll,
    3: swiftGateChiado,
    4: swiftGateMantle,
    5: swiftGateTaiko
}

const numSignatures = 13;
let governorPKs = [];
let governors = [];
for(i = 11; i < numSignatures + 11; i++) { 
    governorPKs.push(i);
    governors.push(new ethers.BaseWallet(new ethers.SigningKey(ethers.solidityPacked(["uint256"], [i]))));
}

async function onSwiftSend(contract, srcChain) {
    contract.on("SwiftSend", async (token_, remoteToken_, amount_, receiver_, dstChain_, isSingle_) => {
        console.log("SwiftSend " + token_ + " " + remoteToken_ + " " + amount_ + " " + receiver_ + " " + dstChain_ + " " + isSingle_);
        try {
            if (remoteToken_ == "0x0000000000000000000000000000000000000000")
                await swiftReceive([token_], [amount_], [receiver_], [srcChain], [dstChain_]);
            else
                await swiftReceive([remoteToken_], [amount_], [receiver_], [srcChain], [dstChain_]);
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

    const contract = chainIdToContract[dstChains[0]];

    await contract.swiftReceive(params, signatures, salt);
}

function signMessage(messageHash) {
    let signatures = [];
    for (i = 0; i < governors.length; i++) {
        let signature = governors[i].signingKey.sign(messageHash);
        signatures.push({v: signature.yParity + 27, r: signature.r, s: signature.s});
    }
    return signatures;
}

onSwiftSend(swiftGateOptimism, 1);
onSwiftSend(swiftGateScroll, 2);
onSwiftSend(swiftGateChiado, 3);
//onSwiftSend(swiftGateMantle, 4);
onSwiftSend(swiftGateTaiko, 5);