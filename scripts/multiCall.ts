/* eslint-disable camelcase */
/* eslint-disable no-process-exit */
/* eslint-disable prettier/prettier */
import { BigNumber, ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

/*
ts-node scripts/multiCall.ts
*/
async function main() {
    const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_URL || "");
    const user = process.env.DEMO_ADDR || "";

    const getPower = await initPowerGetter(provider);
    const block = await provider.getBlockNumber();
    const power = await getPower(user, block, 0.1);
    console.log("power %s block: %s %s", user, block, ethers.utils.formatEther(power.sosPower));
    console.log("lp    %s block: %s %s", user, block, ethers.utils.formatEther(power.lpAdjustedBalance));
}

async function initPowerGetter(provider: ethers.providers.JsonRpcProvider) {
    const SOS_WETH_POOL_ID = 45;
    const utils = ethers.utils;

    const multiCall = new ethers.Contract("0x5ba1e12693dc8f9c48aad8770482f4739beed696", [
        "function aggregate(tuple(address target, bytes callData)[] calls) returns (uint256 blockNumber, bytes[] returnData)",
    ], provider);

    const veSOS = new ethers.Contract("0xEDd27C961CE6f79afC16Fd287d934eE31a90D7D1", [
        "function getSOSPool() public view returns(uint256)",
        "function totalSupply() public view returns(uint256)",
        "function balanceOf(address account) public view returns(uint256)",
    ], provider);

    const SOS = new ethers.Contract("0x3b484b82567a09e2588A13D54D032153f0c0aEe0", [
        "function balanceOf(address account) public view returns(uint256)",
    ], provider);

    const sosWETHPair = new ethers.Contract("0xB84C45174Bfc6b8F3EaeCBae11deE63114f5c1b2", [
        "function totalSupply() public view returns(uint256)",
        "function balanceOf(address account) public view returns(uint256)",
    ], provider);

    const chefV2 = new ethers.Contract("0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d", [
        "function userInfo(uint256, address _a) external view returns (uint256, uint256)",
    ], provider);

    const veSOSGetSOSPoolData: string = (await veSOS.populateTransaction.getSOSPool()).data || "";
    const veSOSTotalSupplyData: string = (await veSOS.populateTransaction.totalSupply()).data || "";
    const sosWETHPairTotalSupplyData: string = (await sosWETHPair.populateTransaction.totalSupply()).data || "";
    const sosBalanceOfWETHPairData: string = (await SOS.populateTransaction.balanceOf(sosWETHPair.address)).data || "";

    async function getPower(account: string, block: number, sosPercent: number) {
        const veSOSBalanceOfAccountData: string = (await veSOS.populateTransaction.balanceOf(account)).data || "";
        const sosWETHPairBalanceOfAccountData: string = (await sosWETHPair.populateTransaction.balanceOf(account)).data || "";
        const sosBalanceOfAccountData: string = (await SOS.populateTransaction.balanceOf(account)).data || "";
        const lpStakedBalanceData = (await chefV2.populateTransaction.userInfo(SOS_WETH_POOL_ID, account)).data || "";

        const [bn, rts] = await multiCall.callStatic.aggregate([
            { target: veSOS.address, callData: veSOSGetSOSPoolData }, // 0
            { target: veSOS.address, callData: veSOSTotalSupplyData }, // 1
            { target: veSOS.address, callData: veSOSBalanceOfAccountData }, // 2
            { target: SOS.address, callData: sosBalanceOfAccountData }, // 3
            { target: chefV2.address, callData: lpStakedBalanceData }, // 4
            { target: sosWETHPair.address, callData: sosWETHPairTotalSupplyData }, // 5
            { target: sosWETHPair.address, callData: sosWETHPairBalanceOfAccountData }, // 6
            { target: SOS.address, callData: sosBalanceOfWETHPairData }, // 7
        ], {
            blockTag: block,
        });

        const veSOSGetSOSPool = BigNumber.from(rts[0].toString());
        const veSOSTotalSupply = BigNumber.from(rts[1].toString());
        const veSOSBalanceOfAccount = BigNumber.from(rts[2].toString());
        const sosBalanceOfAccount = BigNumber.from(rts[3].toString());
        const lpStakedBalance = utils.defaultAbiCoder.decode(["uint256", "uint256"], rts[4])[0];
        const sosWETHPairTotalSupply = BigNumber.from(rts[5].toString());
        const sosWETHPairBalanceOfAccount = BigNumber.from(rts[6].toString());
        const sosBalanceOfWETHPair = BigNumber.from(rts[7].toString());

        type Power = {
            blockNum: BigNumber,
            sosPower: BigNumber,
            sosBalance: BigNumber,
            veSosBalance: BigNumber,
            lpUnstaked: BigNumber,
            lpStakedBalance: BigNumber,
            lpAdjustedBalance: BigNumber,
        };
        const result: Power = {
            blockNum: bn,
            sosBalance: sosBalanceOfAccount,
            lpStakedBalance: lpStakedBalance,
            sosPower: BigNumber.from(0),
            veSosBalance: BigNumber.from(0),
            lpUnstaked: BigNumber.from(0),
            lpAdjustedBalance: BigNumber.from(0),
        };

        // uint256 sosBalance = sosToken.balanceOf(account);
        let sosBalance = sosBalanceOfAccount;
        sosBalance = sosBalance.mul(Math.floor(sosPercent * 10000000)).div(10000000); // We weak the power of SOS.

        // veSOS Balance
        let _stakedSOS = BigNumber.from(0); // uint256 _stakedSOS = 0;
        {
            const totalSOS = veSOSGetSOSPool; // uint256 totalSOS = vesosToken.getSOSPool();
            const totalShares = veSOSTotalSupply; // uint256 totalShares = vesosToken.totalSupply();
            const _share = veSOSBalanceOfAccount; // uint256 _share = vesosToken.balanceOf(account);
            if (!totalShares.isZero()) { // if (totalShares != 0) {
                _stakedSOS = _share.mul(totalSOS).div(totalShares); // _stakedSOS = _share * totalSOS / totalShares;
            }
        }
        result.veSosBalance = veSOSBalanceOfAccount;

        // LP Provider
        // (uint256 lpStakedBalance, ) = chefV2.userInfo(SOS_WETH_POOL_ID, account);
        // uint256 lpUnstaked = sosWETHPair.balanceOf(account);
        const lpUnstaked = sosWETHPairBalanceOfAccount;
        // uint256 lpBalance = lpStakedBalance + lpUnstaked;
        const lpBalance = lpStakedBalance.add(lpUnstaked);

        result.lpUnstaked = lpUnstaked;

        // uint256 lpAdjustedBalance = lpBalance * sosToken.balanceOf(address(sosWETHPair)) / sosWETHPair.totalSupply() * 2;
        const lpAdjustedBalance = lpBalance.mul(sosBalanceOfWETHPair).div(sosWETHPairTotalSupply).mul(2);

        // Sum them up!
        // uint256 combinedSOSBalance = sosBalance + lpAdjustedBalance + _stakedSOS;
        const combinedSOSBalance = sosBalance.add(lpAdjustedBalance).add(_stakedSOS);
        result.sosPower = combinedSOSBalance;
        result.lpAdjustedBalance = lpAdjustedBalance;
        return result;
    }
    return getPower;
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

// const DATA = {
//     "code": 20000,
//     "message": "OK",
//     "data": {
//         "address": "0x8c0d2b62f133db265ec8554282ee60eca0fd5a9e",
//         "data7Days": [
//             {
//                 "block": 14070000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "377510961753.3948141496184822",
//                 "stakedSlpBalance": "0",
//                 "time": 1643049678,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14071000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "377712688206.2492701714165103",
//                 "stakedSlpBalance": "0",
//                 "time": 1643062876,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14072000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "377919000801.0382121276004991",
//                 "stakedSlpBalance": "0",
//                 "time": 1643076386,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14073000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "378125807876.9033355097874191",
//                 "stakedSlpBalance": "0",
//                 "time": 1643089915,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14074000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "378333098460.4939696582346181",
//                 "stakedSlpBalance": "0",
//                 "time": 1643103444,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14075000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "378542282731.0400403151848423",
//                 "stakedSlpBalance": "0",
//                 "time": 1643117060,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14076000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "378747528204.9654612244465012",
//                 "stakedSlpBalance": "0",
//                 "time": 1643130474,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14077000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "378951965206.2388688084486997",
//                 "stakedSlpBalance": "0",
//                 "time": 1643143803,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14078000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "379148337466.413651797696228",
//                 "stakedSlpBalance": "0",
//                 "time": 1643156615,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14079000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "379348981802.9772382038923494",
//                 "stakedSlpBalance": "0",
//                 "time": 1643169691,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14080000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "379554890862.6751722048449899",
//                 "stakedSlpBalance": "0",
//                 "time": 1643183227,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14081000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "379765901102.7876627519671007",
//                 "stakedSlpBalance": "0",
//                 "time": 1643197139,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14082000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "379956562194.536660693548849",
//                 "stakedSlpBalance": "0",
//                 "time": 1643209703,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14083000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "380162453225.5069882280697379",
//                 "stakedSlpBalance": "0",
//                 "time": 1643223274,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14084000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "380370699486.5093192284677231",
//                 "stakedSlpBalance": "0",
//                 "time": 1643236983,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14085000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "380574433768.8388242164517408",
//                 "stakedSlpBalance": "0",
//                 "time": 1643250395,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14086000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "380771643638.3630784182897703",
//                 "stakedSlpBalance": "0",
//                 "time": 1643263385,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14087000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "380979532851.9760884832572873",
//                 "stakedSlpBalance": "0",
//                 "time": 1643277087,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14088000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "381187523110.7126005446814693",
//                 "stakedSlpBalance": "0",
//                 "time": 1643290823,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14089000,
//                 "sosBalance": "1089763641.2786919254928309",
//                 "sosPower": "381382716383.818531902524124",
//                 "stakedSlpBalance": "0",
//                 "time": 1643303871,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14090000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "381726173679.257302829714519",
//                 "stakedSlpBalance": "0",
//                 "time": 1643317012,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14091000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "381923546656.6445675192232791",
//                 "stakedSlpBalance": "0",
//                 "time": 1643330208,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14092000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "382123738825.9681672918059187",
//                 "stakedSlpBalance": "0",
//                 "time": 1643343614,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14093000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "382326897150.0896784759556084",
//                 "stakedSlpBalance": "0",
//                 "time": 1643357231,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14094000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "382533832109.4793168204730246",
//                 "stakedSlpBalance": "0",
//                 "time": 1643371124,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14095000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "382722345778.5393395710538467",
//                 "stakedSlpBalance": "0",
//                 "time": 1643383903,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14096000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "382921454378.5609292940694398",
//                 "stakedSlpBalance": "0",
//                 "time": 1643397402,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14097000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "383116345341.678532952264161",
//                 "stakedSlpBalance": "0",
//                 "time": 1643410629,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14098000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "383306606964.7489780389584054",
//                 "stakedSlpBalance": "0",
//                 "time": 1643423560,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14099000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "383500453035.1700721532459719",
//                 "stakedSlpBalance": "0",
//                 "time": 1643437040,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14100000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "383687441380.7270408400324893",
//                 "stakedSlpBalance": "0",
//                 "time": 1643450273,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14101000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "383880199208.4962050293516952",
//                 "stakedSlpBalance": "0",
//                 "time": 1643463925,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14102000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "384069525777.4688305608486301",
//                 "stakedSlpBalance": "0",
//                 "time": 1643477325,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14103000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "384256742856.1676339949785145",
//                 "stakedSlpBalance": "0",
//                 "time": 1643490542,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14104000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "384446900838.6263700692395082",
//                 "stakedSlpBalance": "0",
//                 "time": 1643503916,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14105000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "384630834943.5888736682281509",
//                 "stakedSlpBalance": "0",
//                 "time": 1643516902,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14106000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "384819934787.3133307522673202",
//                 "stakedSlpBalance": "0",
//                 "time": 1643530381,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14107000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "385010414803.1827139816517479",
//                 "stakedSlpBalance": "0",
//                 "time": 1643544019,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14108000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "385196541456.1589538113410799",
//                 "stakedSlpBalance": "0",
//                 "time": 1643557452,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14109000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "385374711538.7169065410423929",
//                 "stakedSlpBalance": "0",
//                 "time": 1643570244,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14110000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "385556788666.4085029039382824",
//                 "stakedSlpBalance": "0",
//                 "time": 1643583240,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14111000,
//                 "sosBalance": "2558722258.2786919254928309",
//                 "sosPower": "385743591587.914538294006864",
//                 "stakedSlpBalance": "0",
//                 "time": 1643596554,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14112000,
//                 "sosBalance": "2731311497.9726919254928309",
//                 "sosPower": "385951446794.8513360776051505",
//                 "stakedSlpBalance": "0",
//                 "time": 1643610336,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14113000,
//                 "sosBalance": "2731311497.9726919254928309",
//                 "sosPower": "386132921198.4921031669226358",
//                 "stakedSlpBalance": "0",
//                 "time": 1643623637,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14114000,
//                 "sosBalance": "2731311497.9726919254928309",
//                 "sosPower": "386310736296.9550847989937934",
//                 "stakedSlpBalance": "0",
//                 "time": 1643636729,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14115000,
//                 "sosBalance": "2731311497.9726919254928309",
//                 "sosPower": "386493459903.5913869294185563",
//                 "stakedSlpBalance": "0",
//                 "time": 1643650174,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14116000,
//                 "sosBalance": "2731311497.9726919254928309",
//                 "sosPower": "386672775669.1397975270709162",
//                 "stakedSlpBalance": "0",
//                 "time": 1643663371,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14117000,
//                 "sosBalance": "2731311497.9726919254928309",
//                 "sosPower": "386854758642.5175253201528606",
//                 "stakedSlpBalance": "0",
//                 "time": 1643676746,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14118000,
//                 "sosBalance": "2731311497.9726919254928309",
//                 "sosPower": "387032797097.2856537793221518",
//                 "stakedSlpBalance": "0",
//                 "time": 1643689840,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             },
//             {
//                 "block": 14119000,
//                 "sosBalance": "6187114572.9726919254928309",
//                 "sosPower": "387556661410.0329615289642034",
//                 "stakedSlpBalance": "0",
//                 "time": 1643703036,
//                 "unstakeSlpBalance": "0",
//                 "veSosBalance": "345678999998.9999999997908162"
//             }
//         ],
//         "sampledInfo": {
//             "hasAllTiersMembership": false,
//             "hasTier1Membership": false,
//             "sosPower": "377510961753.3948141496184822"
//         }
//     }
// };

// eslint-disable-next-line no-unused-vars
// async function compareWithCSOS() {
//     const combined = (await ethers.getContractFactory("OpenDAOCombined")).attach("0x41CBAC56EA5eC878135082f0F8d9a232a854447E");
//     const balanceOf = async (account: string, block: number) => {
//         return await combined.balanceOf(account, { blockTag: block })
//     }

//     const account = process.env.DEMO_ADDR || "";
//     const getPower = await initPowerGetter(ethers);

//     let b = await ethers.provider.getBlockNumber();
//     console.log("[")
//     for (let i = 0; i < 20; i++) {
//         const [aa, bb, cc] = await Promise.all([
//             balanceOf(account, b), getPower(account, b, 1), getPower(account, b, 0.1)
//         ])
//         expect(aa.toString()).eq(bb.sosPower.toString());
//         console.log("%s,", JSON.stringify({
//             account, blockNum: b, power: ethers.utils.formatEther(cc.sosPower)
//         }));
//         b -= 1661;
//     }
//     console.log("]")
// }
// const multiCallAbi = [{ "inputs": [{ "components": [{ "internalType": "address", "name": "target", "type": "address" }, { "internalType": "bytes", "name": "callData", "type": "bytes" }], "internalType": "struct Multicall2.Call[]", "name": "calls", "type": "tuple[]" }], "name": "aggregate", "outputs": [{ "internalType": "uint256", "name": "blockNumber", "type": "uint256" }, { "internalType": "bytes[]", "name": "returnData", "type": "bytes[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "components": [{ "internalType": "address", "name": "target", "type": "address" }, { "internalType": "bytes", "name": "callData", "type": "bytes" }], "internalType": "struct Multicall2.Call[]", "name": "calls", "type": "tuple[]" }], "name": "blockAndAggregate", "outputs": [{ "internalType": "uint256", "name": "blockNumber", "type": "uint256" }, { "internalType": "bytes32", "name": "blockHash", "type": "bytes32" }, { "components": [{ "internalType": "bool", "name": "success", "type": "bool" }, { "internalType": "bytes", "name": "returnData", "type": "bytes" }], "internalType": "struct Multicall2.Result[]", "name": "returnData", "type": "tuple[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "blockNumber", "type": "uint256" }], "name": "getBlockHash", "outputs": [{ "internalType": "bytes32", "name": "blockHash", "type": "bytes32" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getBlockNumber", "outputs": [{ "internalType": "uint256", "name": "blockNumber", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getCurrentBlockCoinbase", "outputs": [{ "internalType": "address", "name": "coinbase", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getCurrentBlockDifficulty", "outputs": [{ "internalType": "uint256", "name": "difficulty", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getCurrentBlockGasLimit", "outputs": [{ "internalType": "uint256", "name": "gaslimit", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getCurrentBlockTimestamp", "outputs": [{ "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "addr", "type": "address" }], "name": "getEthBalance", "outputs": [{ "internalType": "uint256", "name": "balance", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getLastBlockHash", "outputs": [{ "internalType": "bytes32", "name": "blockHash", "type": "bytes32" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "bool", "name": "requireSuccess", "type": "bool" }, { "components": [{ "internalType": "address", "name": "target", "type": "address" }, { "internalType": "bytes", "name": "callData", "type": "bytes" }], "internalType": "struct Multicall2.Call[]", "name": "calls", "type": "tuple[]" }], "name": "tryAggregate", "outputs": [{ "components": [{ "internalType": "bool", "name": "success", "type": "bool" }, { "internalType": "bytes", "name": "returnData", "type": "bytes" }], "internalType": "struct Multicall2.Result[]", "name": "returnData", "type": "tuple[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "bool", "name": "requireSuccess", "type": "bool" }, { "components": [{ "internalType": "address", "name": "target", "type": "address" }, { "internalType": "bytes", "name": "callData", "type": "bytes" }], "internalType": "struct Multicall2.Call[]", "name": "calls", "type": "tuple[]" }], "name": "tryBlockAndAggregate", "outputs": [{ "internalType": "uint256", "name": "blockNumber", "type": "uint256" }, { "internalType": "bytes32", "name": "blockHash", "type": "bytes32" }, { "components": [{ "internalType": "bool", "name": "success", "type": "bool" }, { "internalType": "bytes", "name": "returnData", "type": "bytes" }], "internalType": "struct Multicall2.Result[]", "name": "returnData", "type": "tuple[]" }], "stateMutability": "nonpayable", "type": "function" }];

    // await compareWithCSOS();
    // for (const day of DATA.data.data7Days) {
    //     const p = await getPower(DATA.data.address, day.block, 0.1);
    //     console.log("block: %s", day.block);

    //     let p1 = ethers.utils.formatEther(p.sosPower).substring(0, 25).replace("0.0", "0");
    //     let p2 = day.sosPower.substring(0, 25);
    //     expect(p1).eq(p2);
    //     // console.log("sosPower %s", p1);
    //     // console.log("sosPower %s", p2);

    //     p1 = ethers.utils.formatEther(p.veSosBalance).substring(0, 25).replace("0.0", "0");
    //     p2 = day.veSosBalance.substring(0, 25);
    //     expect(p1).eq(p2);
    //     // console.log("veSosBalance %s", p1);
    //     // console.log("veSosBalance %s", p2);

    //     p1 = ethers.utils.formatEther(p.sosBalance).substring(0, 25).replace("0.0", "0");
    //     p2 = day.sosBalance.substring(0, 25);
    //     expect(p1).eq(p2);
    //     // console.log("sosBalance %s", p1);
    //     // console.log("sosBalance %s", p2);

    //     p1 = ethers.utils.formatEther(p.lpStakedBalance).substring(0, 25).replace("0.0", "0");
    //     p2 = day.stakedSlpBalance.substring(0, 25);
    //     expect(p1).eq(p2);
    //     // console.log("lpStakedBalance %s", p1);
    //     // console.log("lpStakedBalance %s", p2);

    //     p1 = ethers.utils.formatEther(p.lpUnstaked).substring(0, 25).replace("0.0", "0");
    //     p2 = day.unstakeSlpBalance.substring(0, 25);
    //     expect(p1).eq(p2);
    //     // console.log("lpUnstaked %s", p1);
    //     // console.log("lpUnstaked %s", p2);
    // }
        // const iface = new ethers.utils.Interface(multiCallAbi);
    // const FormatTypes = ethers.utils.FormatTypes;
    // console.log(iface.format(FormatTypes.full))

    // const multiCall = (await ethers.getContractFactory("Multicall2")).attach("0x5ba1e12693dc8f9c48aad8770482f4739beed696");
    // const veSOS = (await ethers.getContractFactory("OpenDAOStaking")).attach("0xEDd27C961CE6f79afC16Fd287d934eE31a90D7D1");
    // const SOS = (await ethers.getContractFactory("OpenDAO")).attach("0x3b484b82567a09e2588A13D54D032153f0c0aEe0");
    // const sosWETHPair = (await ethers.getContractFactory("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20")).attach("0xB84C45174Bfc6b8F3EaeCBae11deE63114f5c1b2");
    // const chefV2 = (await ethers.getContractFactory("MasterChefV2Mock")).attach("0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d");
