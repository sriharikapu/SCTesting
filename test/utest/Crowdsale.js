/*
 *  Universal test: crowdsale.
 */

'use strict';

import expectThrow from '../helpers/expectThrow';
import {l} from '../helpers/debug';
import '../helpers/typeExt';


export function crowdsaleUTest(role, instantiate, settings) {
    // default settings

    const defaultSettings = {
        // extraPaymentFunction: '',
        // rate: ,
        startTime: undefined,
        endTime: undefined,
        maxTimeBonus: 0,

        tokenTransfersDuringSale: false,

        firstPostICOTxFinishesSale: true,

        hasAnalytics: false,
        analyticsPaymentBonus: 0
    };

    for (let k in defaultSettings)
        if (!(k in settings))
            settings[k] = defaultSettings[k];


    // utility consts

    // if true gathered ether goes to contract, otherwise to pre-existed account
    const usingFund = !('cash' in role);
    const AnalyticProxy = settings.hasAnalytics ? artifacts.require("AnalyticProxy") : undefined;


    // utility functions

    function assertBigNumberEqual(actual, expected, message=undefined) {
        assert(actual.eq(expected), "{2}expected {0}, but got: {1}".format(expected, actual,
            message ? message + ': ' : ''));
    }

    async function assertBalances(sale, token, cash, cashInitial, cashAdded) {
        assert.equal(await web3.eth.getBalance(sale.address), 0, "expecting balance of the sale to be empty");
        assert.equal(await web3.eth.getBalance(token.address), 0, "expecting balance of the token to be empty");
        const actualCashAdded = (await web3.eth.getBalance(cash)).sub(cashInitial);
        assert(actualCashAdded.eq(cashAdded), "expecting invested cash to be {0}, but got: {1}".format(cashAdded, actualCashAdded));
    }

    async function assertTokenBalances(token, expectedBalances) {
        for (const acc in expectedBalances) {
            const balance = await token.balanceOf(acc);
            assert(balance.eq(expectedBalances[acc]),
                "expecting token balance of {0} to be {1}, but got: {2}".format(acc, expectedBalances[acc], balance));
        }
    }

    function calcTokens(wei, rate, bonuses) {
        const base = new web3.BigNumber(wei).mul(rate);
        const bonusesSum = bonuses.reduce((accumulator, currentValue) => accumulator + currentValue);
        return base.mul(100 + bonusesSum).div(100);
    }

    async function checkNoTransfers(token) {
        await expectThrow(token.transfer(role.nobody, 1000, {from: role.nobody}));
        await expectThrow(token.transfer(role.investor3, 1000, {from: role.nobody}));
        // TODO transfer (await token.balanceOf(role.investor1)).div(10).add(1000) tokens
        await expectThrow(token.transfer(role.nobody, 1000, {from: role.investor1}));
        await expectThrow(token.transfer(role.investor3, 1000, {from: role.investor2}));
    }


    // testing-related functions

    async function ourInstantiate() {
        const [sale, token, cash] = await instantiate();

        if (settings.hasAnalytics) {
            await sale.createMorePaymentChannels(5, {from: role.owner1});
            sale.testPaymentChannels = await sale.readPaymentChannels();
            sale.testNextPaymentChannel = 0;
        }

        return [sale, token, cash];
    }


    const paymentFunctions = [];
    paymentFunctions.push(['ff', (crowdsale, web3args) => crowdsale.sendTransaction(web3args)]);
    if (settings.extraPaymentFunction)
        paymentFunctions.push([settings.extraPaymentFunction, (crowdsale, web3args) => crowdsale[settings.extraPaymentFunction](web3args)]);
    if (settings.hasAnalytics)
        paymentFunctions.push(['analytics proxy', function(crowdsale, web3args){
            const address = crowdsale.testPaymentChannels[crowdsale.testNextPaymentChannel++];
            if (crowdsale.testNextPaymentChannel == crowdsale.testPaymentChannels.length)
                crowdsale.testNextPaymentChannel = 0;

            return AnalyticProxy.at(address).sendTransaction(web3args);
        }]);


    // tests

    const tests = [];


    tests.push(["test instantiation", async function() {
        const cashInitial = usingFund ? 0 : await web3.eth.getBalance(role.cash);

        const [sale, token, cash] = await ourInstantiate();

        assert.equal(await token.m_controller(), sale.address);

        await assertBalances(sale, token, cash, cashInitial, 0);
    }]);


    if (paymentFunctions.length > 1) {
        tests.push(["test mixing payment functions", async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await web3.eth.getBalance(funds);
            const expectedTokenBalances = {};

            if (settings.startTime)
                await crowdsale.setTime(settings.startTime + 1, {from: role.owner1});

            let tokens = new web3.BigNumber(0);
            for (const [paymentFunctionName, pay] of paymentFunctions) {
                await pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')});

                const paymentBonus = 'analytics proxy' == paymentFunctionName ? settings.analyticsPaymentBonus : 0;
                tokens = tokens.add(calcTokens(web3.toWei(20, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]));
            }

            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20 * paymentFunctions.length, 'finney'));
            expectedTokenBalances[role.investor1] = tokens;
            await assertTokenBalances(token, expectedTokenBalances);
        }]);
    }


    for (const [paymentFunctionName, pay] of paymentFunctions) {

        const paymentBonus = 'analytics proxy' == paymentFunctionName ? settings.analyticsPaymentBonus : 0;

        function testName(name) {
            return "{0} (payment function: {1})".format(name, paymentFunctionName);
        }

        tests.push([testName("test investments"), async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await web3.eth.getBalance(funds);
            const expectedTokenBalances = {};

            if (settings.startTime) {
                // too early!
                await crowdsale.setTime(settings.startTime - 86400*365*2, {from: role.owner1});
                await expectThrow(pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')}));
                await crowdsale.setTime(settings.startTime - 1, {from: role.owner1});
                await expectThrow(pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')}));
            }

            // first investment at the first second
            if (settings.startTime)
                await crowdsale.setTime(settings.startTime, {from: role.owner1});

            await pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));
            expectedTokenBalances[role.investor1] = calcTokens(web3.toWei(20, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);

            await expectThrow(pay(crowdsale, {from: role.nobody, value: web3.toWei(0, 'finney')}));
            assert.equal(await token.balanceOf(role.nobody), 0);

            // cant invest into other contracts
            await expectThrow(token.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')}));
            if (usingFund)
                await expectThrow(funds.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')}));

            // first investment of investor2
            if (settings.startTime)
                await crowdsale.setTime(settings.startTime + 100, {from: role.owner1});

            await pay(crowdsale, {from: role.investor2, value: web3.toWei(100, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(120, 'finney'));
            expectedTokenBalances[role.investor2] = calcTokens(web3.toWei(100, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);

            // 2nd investment of investor1
            await pay(crowdsale, {from: role.investor1, value: web3.toWei(30, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(150, 'finney'));
            expectedTokenBalances[role.investor1] = expectedTokenBalances[role.investor1].add(
                    calcTokens(web3.toWei(30, 'finney'), settings.rate,
                            [settings.maxTimeBonus, paymentBonus]));
            await assertTokenBalances(token, expectedTokenBalances);

            if (! settings.tokenTransfersDuringSale)
                await checkNoTransfers(token);

            /* optional checks
            await checkNotWithdrawing(crowdsale, token, funds);
            await checkNotSendingEther(crowdsale, token, funds);
            */

            if (settings.endTime) {
                // too late
                await crowdsale.setTime(settings.endTime, {from: role.owner1});
                const postSaleTx = pay(crowdsale, {from: role.investor2, value: web3.toWei(20, 'finney')});
                if (settings.firstPostICOTxFinishesSale)
                    // expecting first post-sale tx to succeed
                    await postSaleTx;
                else
                    await expectThrow(postSaleTx);
                await assertTokenBalances(token, expectedTokenBalances);    // anyway, nothing gained

                await expectThrow(pay(crowdsale, {from: role.nobody, value: web3.toWei(20, 'finney')}));
                assert.equal(await token.balanceOf(role.nobody), 0);
            }

            const totalSupply = await token.totalSupply();
            const totalSupplyExpected = Object.values(expectedTokenBalances).reduce((accumulator, currentValue) => accumulator.add(currentValue));
            assertBigNumberEqual(totalSupply, totalSupplyExpected);

            /* optional checks
            await checkNotInvesting(crowdsale, token, funds);
            await checkNotWithdrawing(crowdsale, token, funds);

            assert.equal(await funds.getInvestorsCount(), 3);
            assert.equal(await funds.m_investors(0), role.investor1);
            assert.equal(await funds.m_investors(1), role.investor2);
            assert.equal(await funds.m_investors(2), role.investor3);*/
        }]);


        tests.push([testName("test max cap"), async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await web3.eth.getBalance(funds);
            const expectedTokenBalances = {};

            if (settings.startTime)
                await crowdsale.setTime(settings.startTime, {from: role.owner1});

            await pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));
            expectedTokenBalances[role.investor1] = calcTokens(web3.toWei(20, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);

            const investor3initial = await web3.eth.getBalance(role.investor3);
            await pay(crowdsale, {from: role.investor3, value: web3.toWei(2000, 'finney'), gasPrice: 0});

            const investor3spent = investor3initial.sub(await web3.eth.getBalance(role.investor3));
            assertBigNumberEqual(investor3spent, web3.toWei(380, 'finney'), 'change has to be sent');

            // optional assert.equal(await crowdsale.m_state(), 4);
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(400, 'finney'));
            expectedTokenBalances[role.investor3] = calcTokens(web3.toWei(380, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);

            /* optional checks
            await checkNotInvesting(crowdsale, token, funds);
            await checkNotWithdrawing(crowdsale, token, funds);*/
        }]);

    }


    if (settings.hasAnalytics)
        tests.push(["test payment channels", async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await web3.eth.getBalance(funds);
            const expectedTokenBalances = {};

            assert.equal(await crowdsale.paymentChannelsCount(), 5);
            const channel1 = await crowdsale.m_paymentChannels(0);
            const channel2 = await crowdsale.m_paymentChannels(1);
            const channel3 = await crowdsale.m_paymentChannels(2);

            if (settings.startTime)
                await crowdsale.setTime(settings.startTime + 2, {from: role.owner1});

            // investor1 -> channel3
            await AnalyticProxy.at(channel3).sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));
            expectedTokenBalances[role.investor1] = calcTokens(web3.toWei(20, 'finney'), settings.rate,
                    [settings.maxTimeBonus, settings.analyticsPaymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel3), web3.toWei(20, 'finney'));

            // investor2 -> channel2
            await AnalyticProxy.at(channel2).sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(120, 'finney'));
            expectedTokenBalances[role.investor2] = calcTokens(web3.toWei(100, 'finney'), settings.rate,
                    [settings.maxTimeBonus, settings.analyticsPaymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel3), web3.toWei(20, 'finney'));
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel2), web3.toWei(100, 'finney'));

            // investor3 -> channel3
            await AnalyticProxy.at(channel3).sendTransaction({from: role.investor3, value: web3.toWei(30, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(150, 'finney'));
            expectedTokenBalances[role.investor3] = calcTokens(web3.toWei(30, 'finney'), settings.rate,
                    [settings.maxTimeBonus, settings.analyticsPaymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel3), web3.toWei(50, 'finney'));
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel2), web3.toWei(100, 'finney'));

            // 2nd investment of investor1 -> channel3
            await AnalyticProxy.at(channel3).sendTransaction({from: role.investor1, value: web3.toWei(30, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(180, 'finney'));
            expectedTokenBalances[role.investor1] = expectedTokenBalances[role.investor1].add(
                    calcTokens(web3.toWei(30, 'finney'), settings.rate, [settings.maxTimeBonus, settings.analyticsPaymentBonus]));
            await assertTokenBalances(token, expectedTokenBalances);
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel3), web3.toWei(80, 'finney'));
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel2), web3.toWei(100, 'finney'));
        }]);


    return tests;
}
