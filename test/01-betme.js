'use strict';

import expectThrow from '../node_modules/openzeppelin-solidity/test/helpers/expectThrow';
import expectEvent from '../node_modules/openzeppelin-solidity/test/helpers/expectEvent';

const BigNumber = web3.BigNumber;
const chai =require('chai');
chai.use(require('chai-bignumber')(BigNumber));
chai.use(require('chai-as-promised')); // Order is important
chai.should();

const BetMe = artifacts.require("BetMe");

function daysInFutureTimestamp(days) {
	const now = new Date();
	const futureDate = new Date(+now + 86400 * days);
	return Math.trunc(futureDate.getTime()/1000);
}

const defaultAssertion = "Norman can light his Zippo cigarette lighter ten times in a row";
const defaultDeadlineDate = daysInFutureTimestamp(14);
const defaultArbiterFee = web3.toWei('1.5');
const zeroAddr = '0x0000000000000000000000000000000000000000';

contract('BetMe', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1]};

	beforeEach(async function () {
		this.inst = await BetMe.new(
			defaultAssertion,
			defaultDeadlineDate,
			defaultArbiterFee,
			zeroAddr,
			zeroAddr,
			{from: acc.owner},
		);
	});

	it('should provide public getter for Assertion', async function() {
		await this.inst.Assertion({from: acc.anyone}).should.eventually.be.equal(defaultAssertion);
	});

	it('should provide public getter for Deadline', async function() {
		await this.inst.Deadline({from: acc.anyone}).should.eventually.be.bignumber.equal(defaultDeadlineDate);
	});

	it('should provide public getter for ArbiterFee', async function() {
		await this.inst.ArbiterFee({from: acc.anyone}).should.eventually.be.bignumber.equal(defaultArbiterFee);
	});

	it('should provide public getter for ArbiterAddress', async function() {
		await this.inst.ArbiterAddress({from: acc.anyone}).should.eventually.be.equal(zeroAddr);
	});

	it('should provide public getter for opponent address', async function() {
		await this.inst.OpponentAddress({from: acc.anyone}).should.eventually.be.equal(zeroAddr);
	});

});

