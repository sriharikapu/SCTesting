'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3 -u 4 -u 5

import expectThrow from './helpers/expectThrow';
import {l, logEvents} from './helpers/debug';

const STQToken = artifacts.require("./STQToken.sol");
const FundsRegistry = artifacts.require("./crowdsale/FundsRegistry.sol");
const STQCrowdsale = artifacts.require("../test_helpers/STQCrowdsaleTestHelper.sol");


// Note: build artifact does not get rebuilt as STQCrowdsale changes (by some reason)
contract('STQCrowdsale', function(accounts) {

    function getRoles() {
        return {
            owner3: accounts[0],
            owner1: accounts[1],
            owner2: accounts[2],
            investor1: accounts[2],
            investor2: accounts[3],
            investor3: accounts[4],
            nobody: accounts[5]
        };
    }

    async function instantiate(args=undefined) {
        if (undefined == args)
            args = {};

        const role = getRoles();

        const funds = await (args.fundsClass || FundsRegistry).new([role.owner1, role.owner2, role.owner3], 2, 0, {from: role.nobody});
        const token = await STQToken.new([role.owner1, role.owner2, role.owner3], {from: role.nobody});
        const crowdsale = await STQCrowdsale.new([role.owner1, role.owner2, role.owner3], token.address, funds.address, {from: role.nobody});

        await token.setController(crowdsale.address, {from: role.owner1});
        await token.setController(crowdsale.address, {from: role.owner2});

        await funds.setController(crowdsale.address, {from: role.owner1});
        await funds.setController(crowdsale.address, {from: role.owner2});

        return [crowdsale, token, funds];
    }

    async function assertBalances(crowdsale, token, funds, expected) {
        assert.equal(await web3.eth.getBalance(crowdsale.address), 0);
        assert.equal(await web3.eth.getBalance(token.address), 0);
        assert.equal(await web3.eth.getBalance(funds.address), expected);
    }

    // converts amount of STQ into STQ-wei
    function STQ(amount) {
        return web3.toWei(amount, 'ether');
    }

    async function checkNotSendingEther(crowdsale, token, funds) {
        const role = getRoles();

        await expectThrow(funds.sendEther(role.nobody, web3.toWei(20, 'finney'), {from: role.nobody}));
        await expectThrow(funds.sendEther(role.investor3, web3.toWei(20, 'finney'), {from: role.investor3}));

        await funds.sendEther(role.owner1, web3.toWei(20, 'finney'), {from: role.owner1});
        await expectThrow(funds.sendEther(role.owner1, web3.toWei(20, 'finney'), {from: role.owner2}));
    }

    async function checkNotWithdrawing(crowdsale, token, funds) {
        const role = getRoles();

        for (const from_ of [role.nobody, role.owner1, role.investor1, role.investor2, role.investor3])
            await expectThrow(funds.withdrawPayments({from: from_}));
    }

    async function checkNotInvesting(crowdsale, token, funds) {
        const role = getRoles();

        for (const from_ of [role.nobody, role.owner1, role.investor1, role.investor2, role.investor3])
            await expectThrow(crowdsale.sendTransaction({from: from_, value: web3.toWei(20, 'finney')}));
    }

    async function checkNoTransfers(crowdsale, token, funds) {
        const role = getRoles();

        await expectThrow(token.transfer(role.nobody, STQ(2.5), {from: role.nobody}));
        await expectThrow(token.transfer(role.investor3, STQ(2.5), {from: role.nobody}));
        await expectThrow(token.transfer(role.investor3, STQ(2.5), {from: role.investor2}));
    }


    it("test instantiation", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        assert.equal(await token.m_controller(), crowdsale.address);
        assert.equal(await funds.m_controller(), crowdsale.address);

        await assertBalances(crowdsale, token, funds, 0);
    });


    it("test investments", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        // too early!
        await crowdsale.setTime(1505531600, {from: role.owner1});
        await expectThrow(crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')}));
        await crowdsale.setTime(1505541599, {from: role.owner1});
        await expectThrow(crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')}));

        // first investment at the first second, +25%
        await crowdsale.setTime(1505692800, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(20, 'finney'));
        // remember: this is STQ balance
        assert.equal(await token.balanceOf(role.investor1), STQ(2.5));
        await expectThrow(crowdsale.sendTransaction({from: role.nobody, value: web3.toWei(0, 'finney')}));
        assert.equal(await token.balanceOf(role.nobody), STQ(0));

        // cant invest into other contracts
        await expectThrow(token.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')}));
        await expectThrow(funds.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')}));

        // +5%
        await crowdsale.setTime(1506560000, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor2), STQ(10.5));

        // 2nd investment of investor1
        await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(140, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(4.6));
        assert.equal(await token.balanceOf(role.investor2), STQ(10.5));

        // +0%
        await crowdsale.setTime(1507660000, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(40, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(180, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(4.6));
        assert.equal(await token.balanceOf(role.investor2), STQ(10.5));
        assert.equal(await token.balanceOf(role.investor3), STQ(4));
        await expectThrow(crowdsale.sendTransaction({from: role.nobody, value: web3.toWei(0, 'finney')}));

        await checkNoTransfers(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);

        // too late
        await crowdsale.setTime(1518660000, {from: role.owner1});
        // this tx will implicitly finish ICO
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(20, 'finney')});
        assert.equal(await token.balanceOf(role.investor2), STQ(10.5));
        await expectThrow(crowdsale.sendTransaction({from: role.nobody, value: web3.toWei(20, 'finney')}));
        assert.equal(await token.balanceOf(role.nobody), STQ(0));

        const totalSupply = await token.totalSupply();  // 95499999999999999998
        assert(totalSupply.lt(STQ(96)) && totalSupply.gt(STQ(95)));

        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);

        assert.equal(await funds.getInvestorsCount(), 3);
        assert.equal(await funds.m_investors(0), role.investor1);
        assert.equal(await funds.m_investors(1), role.investor2);
        assert.equal(await funds.m_investors(2), role.investor3);
    });


    it("test before ICO", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505541600, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
        await crowdsale.setTime(1505551600, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(60, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(80, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(3));
        assert.equal(await token.balanceOf(role.investor2), STQ(9));

        await checkNoTransfers(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);
    });


    it("test min cap", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692800, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
        await crowdsale.setTime(1506560000, {from: role.owner1});   // +5%
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(60, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(80, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor2), STQ(6.3));

        await crowdsale.setTime(1508371200, {from: role.owner1});
        await crowdsale.checkTime({from: role.owner1});

        assert.equal(await crowdsale.m_state(), 3);

        await expectThrow(funds.withdrawPayments({from: role.investor3}));
        await expectThrow(funds.withdrawPayments({from: role.owner3}));
        await funds.withdrawPayments({from: role.investor2});
        await assertBalances(crowdsale, token, funds, web3.toWei(20, 'finney'));

        await expectThrow(funds.withdrawPayments({from: role.nobody}));

        await checkNoTransfers(crowdsale, token, funds);
        await checkNotInvesting(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);

        await funds.withdrawPayments({from: role.investor1});
        await assertBalances(crowdsale, token, funds, web3.toWei(0, 'finney'));
    });


    it("test max cap", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692800, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(20, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(20, 'finney'));
        assert.equal(await token.balanceOf(role.investor2), STQ(2.5));
        assert.equal(await token.totalSupply(), STQ(2.5));

        const investor3initial = await web3.eth.getBalance(role.investor3);
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(2000, 'finney')});

        const investor3spent = investor3initial.sub(await web3.eth.getBalance(role.investor3));
        assert(investor3spent.lt(web3.toWei(1000, 'finney')), 'change has to be sent');

        assert.equal(await crowdsale.m_state(), 4);
        await assertBalances(crowdsale, token, funds, web3.toWei(400, 'finney'));
        assert.equal(await token.balanceOf(role.investor2), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor3), STQ(47.5));

        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
    });


    it("test minting for owners", async function() {
        const role = getRoles();

        let [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692800, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor2), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(15));

        await crowdsale.setTime(1508371200, {from: role.owner1});
        await crowdsale.checkTime({from: role.owner1});

        assert.equal(await token.balanceOf(role.owner1), STQ(20));
        assert.equal(await token.balanceOf(role.owner2), STQ(22.5));    // he is also investor1
        assert.equal(await token.balanceOf(role.owner3), STQ(20));
        assert.equal(await token.balanceOf(role.investor1), STQ(22.5)); // he is also owner2!
        assert.equal(await token.balanceOf(role.investor2), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(75));
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));

        // now, without owner-and-investor person

        [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692800, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(20, 'finney')});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor2), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor3), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(15));

        // finish
        await crowdsale.setTime(1508371200, {from: role.owner1});
        await crowdsale.checkTime({from: role.owner1});

        assert.equal(await token.balanceOf(role.owner1), STQ(20));
        assert.equal(await token.balanceOf(role.owner2), STQ(20));
        assert.equal(await token.balanceOf(role.owner3), STQ(20));
        assert.equal(await token.balanceOf(role.investor2), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor3), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(75));
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
    });


    it("test transfers", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692800, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(20, 'finney')});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor3), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor2), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(15));

        await checkNoTransfers(crowdsale, token, funds);

        // finish
        await crowdsale.setTime(1508371200, {from: role.owner1});
        await crowdsale.checkTime({from: role.owner1});

        await expectThrow(token.transfer(role.nobody, STQ(2.5), {from: role.nobody}));
        await expectThrow(token.transfer(role.investor3, STQ(2.5), {from: role.nobody}));

        await token.transfer(role.investor3, STQ(2.5), {from: role.investor2});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor3), STQ(5));
        assert.equal(await token.balanceOf(role.investor2), STQ(10));
        assert.equal(await token.totalSupply(), STQ(75));   // 15 + 60 minted for owners

        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
    });


    it("test pause", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692810, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(20, 'finney')});
        await crowdsale.setTime(1505692812, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor3), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor2), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(15));

        // pause
        await expectThrow(crowdsale.pause({from: role.nobody}));
        await expectThrow(crowdsale.pause({from: role.investor3}));
        await crowdsale.pause({from: role.owner3});
        assert.equal(await crowdsale.m_state(), 2);

        await checkNoTransfers(crowdsale, token, funds);
        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);

        // continue
        await crowdsale.unpause({from: role.owner1});
        assert.equal(await crowdsale.m_state(), 2);
        await crowdsale.unpause({from: role.owner3});
        assert.equal(await crowdsale.m_state(), 1);

        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(20, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(140, 'finney'));
        assert.equal(await token.balanceOf(role.investor3), STQ(5));
        assert.equal(await token.balanceOf(role.investor2), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(17.5));

        await checkNoTransfers(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);

        // finish
        await crowdsale.setTime(1508371200, {from: role.owner1});
        await crowdsale.checkTime({from: role.owner1});
        assert.equal(await crowdsale.m_state(), 4);
        await assertBalances(crowdsale, token, funds, web3.toWei(140, 'finney'));
    });


    it("test fail from pause", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692810, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(20, 'finney')});
        await crowdsale.setTime(1505692812, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor3), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor2), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(15));

        await crowdsale.pause({from: role.owner3});

        // fail
        await crowdsale.fail({from: role.owner1});
        assert.equal(await crowdsale.m_state(), 2);
        await crowdsale.fail({from: role.owner3});
        assert.equal(await crowdsale.m_state(), 3);

        await checkNoTransfers(crowdsale, token, funds);
        await checkNotInvesting(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);
    });


    it("test sending ether", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692810, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(20, 'finney')});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));

        await checkNoTransfers(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);

        // finish
        await crowdsale.setTime(1508371200, {from: role.owner1});
        await crowdsale.checkTime({from: role.owner1});

        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);

        let initial = await web3.eth.getBalance(role.owner1);
        await funds.sendEther(role.owner1, web3.toWei(40, 'finney'), {from: role.owner2});
        await funds.sendEther(role.owner1, web3.toWei(40, 'finney'), {from: role.owner3});
        let added = (await web3.eth.getBalance(role.owner1)).sub(initial);
        assert.equal(added, web3.toWei(40, 'finney'));

        initial = await web3.eth.getBalance(role.owner2);
        await funds.sendEther(role.owner2, web3.toWei(10, 'finney'), {from: role.owner1});
        await funds.sendEther(role.owner2, web3.toWei(10, 'finney'), {from: role.owner3});
        added = (await web3.eth.getBalance(role.owner2)).sub(initial);
        assert.equal(added, web3.toWei(10, 'finney'));

        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
    });


    it("test auto-pause", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate({
            fundsClass: artifacts.require("../test_helpers/crowdsale/FundsRegistryTestHelper.sol")
        });

        await crowdsale.setTime(1505692810, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(20, 'finney')});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));

        assert.equal(await crowdsale.m_state(), 1);
        await funds.burnSomeEther({from: role.owner1});
        assert.equal(await crowdsale.m_state(), 1);

        await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
        assert.equal(await crowdsale.m_state(), 2);

        await checkNoTransfers(crowdsale, token, funds);
        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);
    });


    it("test emissions", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692810, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor2, value: web3.toWei(20, 'finney')});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));

        // finish
        await crowdsale.setTime(1508371200, {from: role.owner1});
        await crowdsale.checkTime({from: role.owner1});

        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);

        assert.equal(await token.balanceOf(role.owner1), STQ(20));
        assert.equal(await token.balanceOf(role.owner2), STQ(20));
        assert.equal(await token.balanceOf(role.owner3), STQ(20));
        assert.equal(await token.balanceOf(role.investor2), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor3), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(75));

        // checking circulation
        await token.transfer(role.investor3, STQ(2.5), {from: role.investor2});
        await token.transfer(role.investor2, STQ(10), {from: role.owner1});
        assert.equal(await token.balanceOf(role.owner1), STQ(10));
        assert.equal(await token.balanceOf(role.owner2), STQ(20));
        assert.equal(await token.balanceOf(role.owner3), STQ(20));
        assert.equal(await token.balanceOf(role.investor2), STQ(10));
        assert.equal(await token.balanceOf(role.investor3), STQ(15));
        assert.equal(await token.totalSupply(), STQ(75));

        await token.emission(15, {from: role.owner2});
        await token.emission(15, {from: role.owner3});
        assert.equal(await token.totalSupply(), STQ(90));

        await token.requestDividends({from: role.investor3});
        await token.requestDividends({from: role.owner1});
        await token.transfer(role.investor2, STQ(5), {from: role.investor3});

        assert.equal(await token.balanceOf(role.owner1), STQ(12));
        assert.equal(await token.balanceOf(role.owner2), STQ(20));
        assert.equal(await token.balanceOf(role.owner3), STQ(20));
        assert.equal(await token.balanceOf(role.investor2), STQ(17));
        assert.equal(await token.balanceOf(role.investor3), STQ(13));
        assert.equal(await token.totalSupply(), STQ(90));

        // further requests change nothing
        await token.requestDividends({from: role.investor2});
        await token.requestDividends({from: role.investor3});
        assert.equal(await token.balanceOf(role.investor2), STQ(17));
        assert.equal(await token.balanceOf(role.investor3), STQ(13));

        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
    });


    it("test crowdsale replacement", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692810, {from: role.owner1});
        await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(100, 'finney')});

        await assertBalances(crowdsale, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor3), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(15));

        // replace
        const crowdsale2 = await STQCrowdsale.new([role.owner1, role.owner2, role.owner3], token.address, funds.address, {from: role.nobody});
        await crowdsale2.setTime(1505692810, {from: role.owner1});

        await token.setController(crowdsale2.address, {from: role.owner1});
        await token.setController(crowdsale2.address, {from: role.owner2});

        await funds.setController(crowdsale2.address, {from: role.owner1});
        await funds.setController(crowdsale2.address, {from: role.owner2});

        // crowdsale is no longer functioning
        await checkNoTransfers(crowdsale, token, funds);
        await checkNotInvesting(crowdsale, token, funds);
        await checkNotWithdrawing(crowdsale, token, funds);
        await checkNotSendingEther(crowdsale, token, funds);

        // tokens and funds are intact
        await assertBalances(crowdsale2, token, funds, web3.toWei(120, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor3), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(15));

        // crowdsale2 is functioning
        await crowdsale2.sendTransaction({from: role.investor2, value: web3.toWei(40, 'finney')});
        await assertBalances(crowdsale2, token, funds, web3.toWei(160, 'finney'));
        assert.equal(await token.balanceOf(role.investor1), STQ(2.5));
        assert.equal(await token.balanceOf(role.investor2), STQ(5));
        assert.equal(await token.balanceOf(role.investor3), STQ(12.5));
        assert.equal(await token.totalSupply(), STQ(20));
    });


    it("test remaining lower than min investment", async function() {
        const role = getRoles();

        const [crowdsale, token, funds] = await instantiate();

        await crowdsale.setTime(1505692810, {from: role.owner1});

        await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(395, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(395, 'finney'));

        await crowdsale.sendTransaction({from: role.investor3, value: web3.toWei(100, 'finney')});
        await assertBalances(crowdsale, token, funds, web3.toWei(400, 'finney'));
        assert.equal(await crowdsale.m_state(), 4);
    });
});
