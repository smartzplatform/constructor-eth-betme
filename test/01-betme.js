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

function constructorArgs(defaults) {
	defaults = defaults == null ? {} : defaults;
	return [
		('Assertion' in defaults ? defaults.Assertion : defaultAssertion),
		('Deadline' in defaults ? defaults.Deadline : defaultDeadlineDate),
		('ArbiterFee' in defaults ? defaults.ArbiterFee : defaultArbiterFee),
		('ArbiterAddress' in defaults ? defaults.ArbiterAddress : zeroAddr),
		('OpponentAddress' in defaults ? defaults.OpponentAddress : zeroAddr),
	];
}

contract('BetMe - constructor and setters', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1], opponent: accounts[2], arbiter: accounts[3]};

	beforeEach(async function () {
		this.inst = await BetMe.new(...constructorArgs(), {from: acc.owner},);
	});

	it('should have initial stateVersion == 0', async function() {
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.zero;
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

	it('should not allow zero deadline in constructor', async function() {
		await expectThrow(BetMe.new(...constructorArgs({Deadline: 0}),  {from: acc.owner}));
	});

	it('should not allow deadline in the past in constructor', async function() {
		const fifteenMinutesAgo = daysInFutureTimestamp(0) - (15 * 30);
		await expectThrow(BetMe.new(...constructorArgs({Deadline: fifteenMinutesAgo}),  {from: acc.owner}));
	});

	it('should not allow empty assertion text in constructor', async function() {
		await expectThrow(BetMe.new(...constructorArgs({Assertion: ""}),  {from: acc.owner}));
	});

	it('should allow arbiter fee close to 100% in constructor', async function() {
		const maxOkFee = web3.toWei('99.9999');
		const inst = BetMe.new(...constructorArgs({ArbiterFee: maxOkFee}),  {from: acc.owner});
		await inst.should.be.eventually.fulfilled;
	});

	it('should not allow arbiter fee = 100% in constructor', async function() {
		const toMuchFee = web3.toWei('100.0');
		await expectThrow(BetMe.new(...constructorArgs({ArbiterFee: toMuchFee}),  {from: acc.owner}));
	});

	it('should not allow arbiter fee > 100% in constructor', async function() {
		const toMuchFee = web3.toWei('101.0');
		await expectThrow(BetMe.new(...constructorArgs({ArbiterFee: toMuchFee}),  {from: acc.owner}));
	});

	it('should not allow set Assertion text if not owner', async function() {
		await expectThrow(this.inst.setAssertionText("12345", {from: acc.anyone}));
	});

	it('should allow owner set Assertion text and increase state version number', async function() {
		const newAssertion = "square has four corners";
		await this.inst.setAssertionText(newAssertion, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.Assertion({from: acc.anyone}).should.eventually.be.equal(newAssertion);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should not allow owner set empty assertion text', async function() {
		await expectThrow(this.inst.setAssertionText("", {from: acc.owner}));
	});

	it('should not allow change Deadline text if not owner', async function() {
		await expectThrow(this.inst.setDeadline(daysInFutureTimestamp(15), {from: acc.anyone}));
	});

	it('should not allow set Deadline in past', async function() {
		const newValue = (await this.inst.Deadline()).sub(3600);
		await expectThrow(this.inst.setDeadline(newValue, {from: acc.owner}));
	});

	it('should allow owner set new Deadline and should increase state version number', async function() {
		const newValue = (await this.inst.Deadline()).add(3600);
		await this.inst.setDeadline(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.Deadline({from: acc.anyone}).should.eventually.be.bignumber.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should not allow set ArbiterFee if not owner', async function() {
		const newValue = web3.toWei('10.5');
		await expectThrow(this.inst.setArbiterFee(newValue, {from: acc.anyone}));
	});

	it('should not allow set ArbiterFee = 100%', async function() {
		const newValue = web3.toWei('100');
		await expectThrow(this.inst.setArbiterFee(newValue, {from: acc.anyone}));
	});

	it('should allow owner set new ArbiterFee and should increase state version number', async function() {
		const newValue = web3.toWei('10');
		await this.inst.setArbiterFee(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.ArbiterFee({from: acc.anyone}).should.eventually.be.bignumber.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should not allow set OpponentAddress if not owner', async function() {
		await expectThrow(this.inst.setOpponentAddress(acc.opponent, {from: acc.anyone}));
	});

	it('should allow owner set new opponent address and should increase state version number', async function() {
		const newValue = acc.opponent;
		await this.inst.setOpponentAddress(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.OpponentAddress({from: acc.anyone}).should.eventually.be.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should allow owner set new opponent address and should increase state version number', async function() {
		const newValue = acc.opponent;
		await this.inst.setOpponentAddress(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.OpponentAddress({from: acc.anyone}).should.eventually.be.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should allow set opponent address to address(0)', async function() {
		const inst = await BetMe.new(...constructorArgs({OpponentAddress: acc.opponent}),  {from: acc.owner});
		await inst.setOpponentAddress(zeroAddr, {from: acc.owner}).should.eventually.be.fulfilled;
		await inst.OpponentAddress({from: acc.anyone}).should.eventually.be.equal(zeroAddr);
	});

	it('should increase version for every modification', async function() {
		await this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setOpponentAddress(zeroAddr, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(2);
	});

	it('should revert if setting opponent address to its previews value', async function() {
		await this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.eventually.be.fulfilled;
		await expectThrow(this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}));
	});

	it('should not allow set ArbiterAddress if not owner', async function() {
		await expectThrow(this.inst.setArbiterAddress(acc.arbiter, {from: acc.anyone}));
	});

	it('should allow owner set arbiter address and should increase state version number', async function() {
		const newValue = acc.arbiter;
		await this.inst.setArbiterAddress(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.ArbiterAddress({from: acc.anyone}).should.eventually.be.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should allow set arbiter address to address(0)', async function() {
		const inst = await BetMe.new(...constructorArgs({ArbiterAddress: acc.arbiter}),  {from: acc.owner});
		await inst.setArbiterAddress(zeroAddr, {from: acc.owner}).should.eventually.be.fulfilled;
		await inst.ArbiterAddress({from: acc.anyone}).should.eventually.be.equal(zeroAddr);
	});

	it('should revert if setting arbiter address to its previews value', async function() {
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		await expectThrow(this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}));
	});

	it('should revert if setting arbiter address equal to owner address', async function() {
		await expectThrow(this.inst.setArbiterAddress(acc.owner, {from: acc.owner}));
	});
});

