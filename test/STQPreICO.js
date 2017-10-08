'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3 -u 4 -u 5

import {crowdsaleUTest} from './utest/Crowdsale';

const STQPreICO = artifacts.require("./test_helpers/STQPreICOTestHelper.sol");
const STQToken = artifacts.require("./STQToken.sol");


contract('STQPreICO', function(accounts) {

    function getRoles() {
        return {
            cash: accounts[0],
            owner3: accounts[0],
            owner1: accounts[1],
            owner2: accounts[2],
            investor1: accounts[2],
            investor2: accounts[3],
            investor3: accounts[4],
            nobody: accounts[5]
        };
    }

    async function instantiate() {
        const role = getRoles();

        const token = await STQToken.new([role.owner1, role.owner2, role.owner3], {from: role.nobody});
        const preICO = await STQPreICO.new(token.address, role.cash, {from: role.nobody});
        preICO.transferOwnership(role.owner1, {from: role.nobody});

        await token.setController(preICO.address, {from: role.owner1});
        await token.setController(preICO.address, {from: role.owner2});

        return [preICO, token, role.cash];
    }


    for (const [name, fn] of crowdsaleUTest(getRoles(), instantiate, {
        extraPaymentFunction: 'buy',
        rate: 100000,
        startTime: (new Date('Thu, 12 Oct 2017 0:00:00 GMT')).getTime() / 1000,
        endTime: (new Date('Fri, 13 Oct 2017 0:00:00 GMT')).getTime() / 1000,
        maxTimeBonus: 40,
        firstPostICOTxFinishesSale: false,
        hasAnalytics: true,
        analyticsPaymentBonus: 2
    }))
        it(name, fn);
});
