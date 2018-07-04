'use strict';

//import expectThrow from '../node_modules/openzeppelin-solidity/test/helpers/expectThrow';

const BigNumber = web3.BigNumber;
const chai =require('chai');
chai.use(require('chai-bignumber')(BigNumber));
chai.use(require('chai-as-promised')); // Order is important
chai.should();

const BetMe = artifacts.require("BetMe");

contract('BetMe', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1]};
	beforeEach(async function () {
		this.inst = await BetMe.new({from: acc.owner});
	});

});

